#!/usr/bin/env python3
"""
backend/proctoring/download_models.py

Downloads the OpenCV DNN face detection model (Caffe format).
Run once during setup:
    python -m backend.proctoring.download_models
"""

import os
import urllib.request

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

FILES = {
    "deploy.prototxt": (
        "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
    ),
    "res10_300x300_ssd_iter_140000.caffemodel": (
        "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/"
        "res10_300x300_ssd_iter_140000.caffemodel"
    ),
}


def download():
    os.makedirs(MODELS_DIR, exist_ok=True)
    for filename, url in FILES.items():
        dest = os.path.join(MODELS_DIR, filename)
        if os.path.exists(dest):
            print(f"✅ Already exists: {filename}")
            continue
        print(f"⬇️  Downloading {filename}…")
        try:
            urllib.request.urlretrieve(url, dest)
            size = os.path.getsize(dest) / (1024 * 1024)
            print(f"   Saved {filename} ({size:.1f} MB)")
        except Exception as e:
            print(f"❌ Failed to download {filename}: {e}")
            print(f"   Please download manually from:\n   {url}")

    print("\n✅ Model setup complete. DNN face detector is ready.")
    print("   If download failed, the system will fall back to Haar cascade (still works).")


if __name__ == "__main__":
    download()
