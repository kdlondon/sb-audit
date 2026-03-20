"use client";
import { useState, useRef, useCallback } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export default function ImageCropper({ src, onCropped, onCancel }) {
  const [crop, setCrop] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const onImageLoad = useCallback((e) => {
    imgRef.current = e.currentTarget;
    // Default crop: center 80%
    const { width, height } = e.currentTarget;
    const size = Math.min(width, height) * 0.8;
    setCrop({
      unit: "px",
      x: (width - size) / 2,
      y: (height - size) / 2,
      width: size,
      height: size,
    });
  }, []);

  const doCrop = async () => {
    if (!completedCrop || !imgRef.current) return;
    setSaving(true);

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropW = completedCrop.width * scaleX;
    const cropH = completedCrop.height * scaleY;

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    setSaving(false);
    onCropped(blob);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center" style={{ zIndex: 100000 }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 bg-black/60 backdrop-blur-sm">
        <span className="text-white/80 text-sm font-medium">Crop image</span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm text-white/70 border border-white/20 rounded-lg hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            onClick={doCrop}
            disabled={saving || !completedCrop}
            className="px-4 py-1.5 text-sm bg-white text-black rounded-lg font-semibold hover:bg-white/90 disabled:opacity-40 transition"
          >
            {saving ? "Saving..." : "Apply crop"}
          </button>
        </div>
      </div>

      {/* Crop area */}
      <div className="flex-1 flex items-center justify-center p-16 max-w-[90vw] max-h-[85vh] overflow-hidden">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          className="max-h-[75vh]"
        >
          <img
            src={src}
            onLoad={onImageLoad}
            crossOrigin="anonymous"
            className="max-h-[75vh] max-w-full object-contain"
            alt=""
          />
        </ReactCrop>
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 text-white/40 text-xs">
        Drag to select crop area
      </div>
    </div>
  );
}
