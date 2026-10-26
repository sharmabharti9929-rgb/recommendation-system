# Backend

The Flask backend loads the artifacts produced by the Jupyter hybrid model.

Expected structure:

backend/
  app.py
  requirements.txt
  data/
    ratings.csv
    posters.csv          # optional
  artifacts/
    tfidf_vectorizer.joblib
    svd_model.joblib
    content_sim.npy
    predicted_ratings.npy
    movies_processed.pkl

Run:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # macOS/Linux
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

API:
- GET /api/health
- GET /api/users
- GET /api/recommendations?user_id=1&top_n=12&alpha=0.6
- GET /api/search?q=matrix
- GET /api/movie/1
