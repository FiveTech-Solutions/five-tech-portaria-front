#!/bin/bash

# Script to download face-api.js models

echo "Downloading face-api.js models..."

MODELS_DIR="public/models"

# Base URL for face-api.js models
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

# Download TinyFaceDetector models
curl -L "${BASE_URL}/tiny_face_detector_model-shard1" -o "${MODELS_DIR}/tiny_face_detector_model-shard1"
curl -L "${BASE_URL}/tiny_face_detector_model-weights_manifest.json" -o "${MODELS_DIR}/tiny_face_detector_model-weights_manifest.json"

# Download Face Landmark models
curl -L "${BASE_URL}/face_landmark_68_model-shard1" -o "${MODELS_DIR}/face_landmark_68_model-shard1"
curl -L "${BASE_URL}/face_landmark_68_model-weights_manifest.json" -o "${MODELS_DIR}/face_landmark_68_model-weights_manifest.json"

# Download Face Recognition models
curl -L "${BASE_URL}/face_recognition_model-shard1" -o "${MODELS_DIR}/face_recognition_model-shard1"
curl -L "${BASE_URL}/face_recognition_model-shard2" -o "${MODELS_DIR}/face_recognition_model-shard2"
curl -L "${BASE_URL}/face_recognition_model-weights_manifest.json" -o "${MODELS_DIR}/face_recognition_model-weights_manifest.json"

# Download Face Expression models
curl -L "${BASE_URL}/face_expression_model-shard1" -o "${MODELS_DIR}/face_expression_model-shard1"
curl -L "${BASE_URL}/face_expression_model-weights_manifest.json" -o "${MODELS_DIR}/face_expression_model-weights_manifest.json"

echo "Face-api models downloaded successfully!"

echo "Downloading Tesseract.js files..."

TESS_VERSION="v4.0.0"
TESS_DATA_VERSION="4.0.0"

# Tesseract.js worker
curl -L "https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/worker.min.js" -o "${MODELS_DIR}/worker.min.js"

# Tesseract.js core
curl -L "https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js" -o "${MODELS_DIR}/tesseract-core.wasm.js"

# Tesseract.js language data (English)
curl -L "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz" -o "${MODELS_DIR}/eng.traineddata.gz"

echo "Tesseract.js files downloaded successfully!"
