import json
from app import create_app
from app.extensions import db
from app.models import KnowledgeDoc
from app.rag.embeddings import embed_text

def reindex():
    app = create_app()
    with app.app_context():
        print("Starting re-indexing of KnowledgeDocs...")
        docs = KnowledgeDoc.query.all()
        for doc in docs:
            print(f"Embedding doc: {doc.title} (ID: {doc.id})")
            vec = embed_text(doc.content_nepali)
            doc.embedding_json = json.dumps(vec)
        
        db.session.commit()
        print(f"Successfully re-indexed {len(docs)} documents.")

if __name__ == "__main__":
    reindex()
