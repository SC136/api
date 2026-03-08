"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import styles from "./page.module.css";

type Model = {
  key: string;
  name: string;
  description: string;
  modes?: string[] | null;
  default_mode?: string | null;
};

type LLMModel = {
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
  const [llms, setLlms] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("florence-2");
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [selectedLlm, setSelectedLlm] = useState("smollm2-1.7b");
  const [prompt, setPrompt] = useState("");
  const [llmResult, setLlmResult] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Fetch available models
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data.models || []);
        setLlms(data.llms || []);
        if (data.llms && data.llms.length > 0 && !data.llms.find((m: LLMModel) => m.key === "smollm2-1.7b")) {
          setSelectedLlm(data.llms[0].key);
        }
      })
      .catch((err) => console.error("Failed to load models:", err));

    return () => {
      // Cleanup webcam on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Effect to handle video element when stream changes
  useEffect(() => {
    if (stream && videoRef.current && showWebcam) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.error("Error playing video:", err);
      });
    }
  }, [stream, showWebcam]);

  // Update selected mode when model list or selection changes
  useEffect(() => {
    const current = models.find((m) => m.key === selectedModel);
    if (current?.modes?.length) {
      setSelectedMode(current.default_mode || current.modes[0]);
    } else {
      setSelectedMode(null);
    }
  }, [models, selectedModel]);

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

      setFile(null);
      setPreview(null);
      setResult(null);
      setShowWebcam(true);
      setStream(mediaStream);
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
      if (selectedMode) {
        formData.append("mode", selectedMode);
      }

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

  const generateText = async () => {
    if (!prompt.trim()) return;
    setLlmLoading(true);
    setLlmResult(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model: selectedLlm }),
      });

      const data = await response.json();
      if (data.error) {
        setLlmResult(`Error: ${data.error}`);
      } else {
        setLlmResult(data.text || data.generated || "");
      }
    } catch (error) {
      setLlmResult("Error generating text. Please try again.");
      console.error(error);
    } finally {
      setLlmLoading(false);
    }
  };

  const currentModel = models.find((m) => m.key === selectedModel);
  const modeValue = selectedMode || currentModel?.default_mode || currentModel?.modes?.[0];

  return (
    <main className={styles.main}>
      <div className={styles.grain} />

      <header className={styles.header}>
        <h1 className={styles.logo}>antigravity</h1>
        <p className={styles.tagline}>AI workbench</p>
      </header>

      <div className={styles.panels}>
        {/* === VISION === */}
        <section className={`${styles.panel} ${styles.panelVision}`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelNumber}>01</span>
            <h2 className={styles.panelTitle}>Vision</h2>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="model-select">Model</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={styles.select}
            >
              {models.map((model) => (
                <option key={model.key} value={model.key}>
                  {model.name} &mdash; {model.description}
                </option>
              ))}
            </select>
          </div>

          {currentModel?.modes && currentModel.modes.length > 0 && (
            <div className={styles.controlGroup}>
              <label className={styles.label} htmlFor="mode-select">Mode</label>
              <select
                id="mode-select"
                value={modeValue}
                onChange={(e) => setSelectedMode(e.target.value)}
                className={styles.select}
              >
                {currentModel.modes.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.mediaActions}>
            <button
              className={styles.btnOutline}
              onClick={startWebcam}
              disabled={showWebcam}
            >
              <span className={styles.btnIcon}>&#9673;</span> Webcam
            </button>
          </div>

          {showWebcam ? (
            <div className={styles.webcamZone}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.webcamVideo}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div className={styles.webcamActions}>
                <button onClick={captureImage} className={styles.btnAccent}>
                  Capture
                </button>
                <button
                  onClick={() => {
                    setShowWebcam(false);
                    if (stream) {
                      stream.getTracks().forEach((track) => track.stop());
                      setStream(null);
                    }
                  }}
                  className={styles.btnGhost}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className={styles.dropZone}
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
                <div className={styles.previewWrap}>
                  <Image
                    src={preview}
                    alt="Preview"
                    fill
                    className={styles.previewImage}
                  />
                  <button className={styles.removeBtn} onClick={clearImage}>
                    &times;
                  </button>
                </div>
              ) : (
                <div className={styles.dropPlaceholder}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Drop image or click to browse</span>
                </div>
              )}
            </div>
          )}

          <button
            className={styles.btnPrimary}
            onClick={analyzeImage}
            disabled={!file || loading}
          >
            {loading ? (
              <span className={styles.loadingInline}>
                <span className={styles.spinner} /> Analyzing&hellip;
              </span>
            ) : (
              "Analyze"
            )}
          </button>

          {result && (
            <div className={styles.resultBox}>
              <h3 className={styles.resultLabel}>Result</h3>
              <div className={styles.resultText}>{result}</div>
            </div>
          )}
        </section>

        {/* === LANGUAGE === */}
        <section className={`${styles.panel} ${styles.panelLanguage}`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelNumber}>02</span>
            <h2 className={styles.panelTitle}>Language</h2>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="llm-select">Model</label>
            <select
              id="llm-select"
              value={selectedLlm}
              onChange={(e) => setSelectedLlm(e.target.value)}
              className={styles.select}
            >
              {llms.map((llm) => (
                <option key={llm.key} value={llm.key}>
                  {llm.name} &mdash; {llm.description}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.label} htmlFor="prompt-input">Prompt</label>
            <textarea
              id="prompt-input"
              className={styles.textarea}
              placeholder="Ask anything — generate text, stories, code…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
            />
          </div>

          <button
            className={styles.btnSecondary}
            onClick={generateText}
            disabled={!prompt.trim() || llmLoading}
          >
            {llmLoading ? (
              <span className={styles.loadingInline}>
                <span className={styles.spinnerLight} /> Generating&hellip;
              </span>
            ) : (
              "Generate"
            )}
          </button>

          {llmResult && (
            <div className={styles.resultBox}>
              <h3 className={styles.resultLabel}>Output</h3>
              <div className={styles.resultText}>{llmResult}</div>
            </div>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        <span>powered by open-source AI models</span>
      </footer>
    </main>
  );
}
