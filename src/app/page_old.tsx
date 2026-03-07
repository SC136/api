"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import styles from "./page.module.css";

type Model = {
  key: string;
  name: string;
  description: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("blip-base");
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Fetch available models
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => setModels(data.models))
      .catch((err) => console.error("Failed to load models:", err));

    return () => {
      // Cleanup webcam on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setShowWebcam(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreview(null);
    setResult(null);
    setShowWebcam(false);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      setStream(mediaStream);
      setShowWebcam(true);
      setFile(null);
      setPreview(null);
      setResult(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
          // Some browsers require an explicit play
          videoRef.current.play().catch(() => {});
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
      alert("Could not access webcam. Please check permissions.");
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], "webcam-capture.jpg", {
              type: "image/jpeg",
            });
            setFile(capturedFile);
            setPreview(URL.createObjectURL(capturedFile));
            setShowWebcam(false);
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
              setStream(null);
            }
          }
        }, "image/jpeg");
      }
    }
  };

  const analyzeImage = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("model", selectedModel);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.error) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult(data.text);
      }
    } catch (error) {
      setResult("Error analyzing image. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Image Analyzer</h1>
        <div className={styles.modelSelector}>
          <label htmlFor="model-select">Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className={styles.modelSelect}
          >
            {models.map((model) => (
              <option key={model.key} value={model.key}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.buttonGroup}>
          <button
            className={styles.webcamButton}
            onClick={startWebcam}
            disabled={showWebcam}
          >
            📷 Use Webcam
          </button>
        </div>

        {showWebcam ? (
          <div className={styles.webcamContainer}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={styles.webcamVideo}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div className={styles.webcamControls}>
              <button onClick={captureImage} className={styles.captureButton}>
                📸 Capture
              </button>
              <button
                onClick={() => {
                  setShowWebcam(false);
                  if (stream) {
                    stream.getTracks().forEach((track) => track.stop());
                    setStream(null);
                  }
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={styles.uploadArea}
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              type="file"
              ref={inputRef}
              onChange={handleFileChange}
              accept="image/*"
              className={styles.hiddenInput}
            />

            {preview ? (
              <div className={styles.previewContainer}>
                <Image
                  src={preview}
                  alt="Preview"
                  fill
                  className={styles.previewImage}
                />
                <button className={styles.removeButton} onClick={clearImage}>
                  ×
                </button>
              </div>
            ) : (
              <div className={styles.uploadPlaceholder}>
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p>Drag & drop or click to upload</p>
              </div>
            )}
          </div>
        )}

        <p className={styles.subtitle}>
          Upload an image to get intelligent descriptions. Powered by open-source AI.
        </p>

        <button
          className={styles.analyzeButton}
          onClick={analyzeImage}
          disabled={!file || loading}
        >
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} /> Analyzing...
            </div>
          ) : (
            "Analyze Image"
          )}
        </button>

        {result && (
          <div className={styles.resultArea}>
            <h2 className={styles.resultTitle}>Analysis Result</h2>
            <div style={{ whiteSpace: "pre-wrap" }}>{result}</div>
          </div>
        )}
      </div>
    </main>
  );
}
