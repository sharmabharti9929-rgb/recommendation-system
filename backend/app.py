from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import pandas as pd
import numpy as np

# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
ARTIFACT_DIR = BASE_DIR / "artifacts"

# ============================================================
# FLASK
# ============================================================

app = Flask(__name__)
CORS(app)

# ============================================================
# LOAD DATA
# ============================================================

print("Loading MovieLens data...")

ratings = pd.read_csv(
    DATA_DIR / "ratings.csv"
)

movies = pd.read_pickle(
    ARTIFACT_DIR / "movies_processed.pkl"
)

print("Ratings:", ratings.shape)
print("Movies:", movies.shape)

# ============================================================
# LOAD TRAINED FACTORS
# ============================================================

print("Loading trained model factors...")

user_factors = np.load(
    ARTIFACT_DIR / "user_factors.npy"
)

movie_factors = np.load(
    ARTIFACT_DIR / "movie_factors.npy"
)

print("User factors:", user_factors.shape)
print("Movie factors:", movie_factors.shape)

# ============================================================
# CREATE ID MAPPINGS
# ============================================================

user_ids = ratings["userId"].unique()

user_id_to_idx = {
    uid: idx
    for idx, uid in enumerate(user_ids)
}

movie_id_to_idx = {
    mid: idx
    for idx, mid in enumerate(movies["movieId"])
}

idx_to_movie_id = {
    idx: mid
    for mid, idx in movie_id_to_idx.items()
}

# ============================================================
# NORMALIZATION
# ============================================================

def minmax(values):

    values = np.asarray(
        values,
        dtype=np.float64
    )

    minimum = values.min()
    maximum = values.max()

    if maximum == minimum:
        return np.zeros_like(values)

    return (
        (values - minimum)
        / (maximum - minimum)
    )


# ============================================================
# HYBRID RECOMMENDATION
# ============================================================

def get_hybrid_scores(user_id, alpha=0.6):

    if user_id not in user_id_to_idx:
        raise ValueError(
            f"User {user_id} not found"
        )

    user_index = user_id_to_idx[user_id]

    # --------------------------------------------------------
    # COLLABORATIVE FILTERING
    # --------------------------------------------------------

    user_vector = user_factors[user_index]

    collaborative_scores = (
        user_vector @ movie_factors.T
    )

    collaborative_scores = minmax(
        collaborative_scores
    )

    # --------------------------------------------------------
    # CONTENT-BASED COMPONENT
    #
    # Use movies highly rated by this user.
    # Movie latent factors are used to calculate similarity.
    # --------------------------------------------------------

    user_history = ratings[
        ratings["userId"] == user_id
    ].sort_values(
        "rating",
        ascending=False
    )

    liked_movies = (
        user_history[
            user_history["rating"] >= 4
        ]
        ["movieId"]
        .head(10)
        .tolist()
    )

    liked_indices = [
        movie_id_to_idx[movie_id]
        for movie_id in liked_movies
        if movie_id in movie_id_to_idx
    ]

    if liked_indices:

        liked_vectors = movie_factors[
            liked_indices
        ]

        # Normalize vectors
        movie_norms = np.linalg.norm(
            movie_factors,
            axis=1,
            keepdims=True
        )

        liked_norms = np.linalg.norm(
            liked_vectors,
            axis=1,
            keepdims=True
        )

        normalized_movies = (
            movie_factors
            / np.maximum(movie_norms, 1e-12)
        )

        normalized_liked = (
            liked_vectors
            / np.maximum(liked_norms, 1e-12)
        )

        similarity = (
            normalized_movies
            @ normalized_liked.T
        )

        content_scores = similarity.mean(
            axis=1
        )

        content_scores = minmax(
            content_scores
        )

    else:

        content_scores = np.zeros(
            len(movies)
        )

    # --------------------------------------------------------
    # HYBRID FUSION
    # --------------------------------------------------------

    hybrid_scores = (
        alpha * collaborative_scores
        +
        (1 - alpha) * content_scores
    )

    return hybrid_scores


# ============================================================
# HOME / TEST
# ============================================================

@app.route("/")
def home():

    return jsonify({
        "message": "Hybrid Movie Recommendation API",
        "status": "running"
    })


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health")
def health():

    return jsonify({
        "status": "ok",
        "movies": int(len(movies)),
        "users": int(len(user_ids))
    })


# ============================================================
# USERS
# ============================================================

@app.route("/api/users")
def users():

    return jsonify([
        int(user_id)
        for user_id in sorted(user_ids)
    ])


# ============================================================
# RECOMMENDATIONS
# ============================================================

@app.route("/api/recommendations")
def recommendations():

    try:

        user_id = int(
            request.args.get(
                "user_id",
                user_ids[0]
            )
        )

        top_n = int(
            request.args.get(
                "top_n",
                12
            )
        )

        alpha = float(
            request.args.get(
                "alpha",
                0.6
            )
        )

        scores = get_hybrid_scores(
            user_id,
            alpha
        )

        result = movies.copy()

        result["hybrid_score"] = scores

        # ----------------------------------------------------
        # REMOVE MOVIES ALREADY WATCHED
        # ----------------------------------------------------

        watched = set(
            ratings.loc[
                ratings["userId"] == user_id,
                "movieId"
            ]
        )

        result = result[
            ~result["movieId"].isin(
                watched
            )
        ]

        # ----------------------------------------------------
        # TOP N
        # ----------------------------------------------------

        result = (
            result
            .sort_values(
                "hybrid_score",
                ascending=False
            )
            .head(top_n)
        )

        output = []

        for _, row in result.iterrows():

            output.append({
                "movieId": int(
                    row["movieId"]
                ),

                "title": str(
                    row["title"]
                ),

                "genres": str(
                    row["genres"]
                ),

                "hybrid_score": round(
                    float(
                        row["hybrid_score"]
                    ),
                    4
                )
            })

        return jsonify(output)

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 400


# ============================================================
# SEARCH MOVIES
# ============================================================

@app.route("/api/search")
def search():

    query = request.args.get(
        "q",
        ""
    ).strip().lower()

    if not query:
        return jsonify([])

    result = movies[
        movies["title"]
        .astype(str)
        .str.lower()
        .str.contains(
            query,
            regex=False,
            na=False
        )
    ].head(20)

    output = []

    for _, row in result.iterrows():

        output.append({
            "movieId": int(
                row["movieId"]
            ),

            "title": str(
                row["title"]
            ),

            "genres": str(
                row["genres"]
            )
        })

    return jsonify(output)


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 50)
    print("HYBRID MOVIE RECOMMENDATION SYSTEM")
    print("=" * 50)
    print("Starting Flask server...")
    print("URL: http://127.0.0.1:5000")
    print("=" * 50)
    print()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )