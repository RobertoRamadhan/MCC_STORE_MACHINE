'use client';

import { useEffect, useRef, useState } from 'react';

type CameraCaptureProps = {
  onCapture: (base64: string) => void;
  onError?: (message: string) => void;
  label?: string;
};

export default function CameraCapture({
  onCapture,
  onError,
  label = 'Ambil Foto Dokumentasi',
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [useFileFallback, setUseFileFallback] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'Browser tidak mendukung kamera. Fallback ke upload file aktif.';
      setUseFileFallback(true);
      setError(msg);
      onError?.(msg);
      return;
    }

    // Coba dulu kamera belakang 1280x720. Kalau perangkat tidak cocok dengan permintaan itu
    // (mis. webcam panel tidak punya "kamera belakang"), ulangi dengan pengaturan paling sederhana.
    const bukaStream = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err: any) {
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') throw err;
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    };

    try {
      const stream = await bukaStream();

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);
      setError('');
      setUseFileFallback(false);
    } catch (err: any) {
      const nama = err?.name || 'Error';
      const msg =
        nama === 'NotAllowedError' || nama === 'SecurityError'
          ? 'Izin kamera ditolak. Izinkan kamera di browser (ikon gembok di address bar) dan di Windows Settings > Privacy > Camera, atau gunakan upload file.'
          : nama === 'NotReadableError' || nama === 'AbortError'
          ? 'Kamera sedang dipakai aplikasi/tab lain (mis. aplikasi Camera, Teams, atau tab MCC lain). Tutup dulu lalu klik Coba lagi, atau gunakan upload file.'
          : nama === 'NotFoundError' || nama === 'OverconstrainedError'
          ? 'Kamera tidak ditemukan di perangkat ini. Cek kabel/driver kamera, atau gunakan upload file.'
          : 'Gagal membuka kamera. Gunakan upload file.';
      setUseFileFallback(true);
      setError(`${msg} (kode: ${nama})`);
      onError?.(`${msg} (kode: ${nama})`);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = String(ev.target?.result || '');
      setPreview(result);
      setIsCapturing(true);
      onCapture(result);
      setError('');
      setUseFileFallback(true);
    };
    reader.readAsDataURL(file);
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      const msg = 'Kamera belum siap.';
      setError(msg);
      onError?.(msg);
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      const msg = 'Resolusi kamera belum tersedia.';
      setError(msg);
      onError?.(msg);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const msg = 'Canvas tidak dapat dibuat.';
      setError(msg);
      onError?.(msg);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    setIsCapturing(true);
    onCapture(dataUrl);
  };

  const retake = () => {
    setPreview('');
    setIsCapturing(false);
    onCapture('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#e5eefb' }}>{label}</div>

      {!preview ? (
        useFileFallback ? (
          <div
            style={{
              border: '2px dashed rgba(148, 163, 184, 0.45)',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.8)',
              minHeight: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 28 }}>📷</span>
              <span>Pilih foto dari file / HP / storage</span>
              <input type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            </label>
          </div>
        ) : (
          <div
            style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#0b1220',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              minHeight: 220,
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: 220,
                objectFit: 'cover',
                display: isReady ? 'block' : 'none',
              }}
            />

            {!isReady && (
              <div
                style={{
                  minHeight: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#cbd5e1',
                  fontSize: 12,
                }}
              >
                Menghubungkan kamera...
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        )
      ) : (
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: '#0b1220',
          }}
        >
          <img
            src={preview}
            alt="Preview foto dokumentasi"
            style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {error && (
        <div style={{ color: '#fca5a5', fontSize: 11, lineHeight: 1.5 }}>
          {error}
          {useFileFallback && !preview && (
            <button
              type="button"
              onClick={() => { stopCamera(); setError(''); setIsReady(false); setUseFileFallback(false); setTimeout(startCamera, 50); }}
              style={{ marginLeft: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.5)', borderRadius: 6, color: '#e2e8f0', fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}
            >
              Coba lagi
            </button>
          )}
        </div>
      )}

      {!preview ? (
        !useFileFallback ? (
          <button
            type="button"
            onClick={captureImage}
            disabled={!isReady}
            style={{
              border: 'none',
              borderRadius: 8,
              background: !isReady ? 'rgba(148, 163, 184, 0.2)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              padding: '10px 14px',
              cursor: !isReady ? 'not-allowed' : 'pointer',
            }}
          >
            {isReady ? '📸 Ambil Foto' : '⏳ Menyiapkan Kamera'}
          </button>
        ) : null
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={retake}
            style={{
              flex: 1,
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.7)',
              color: '#e2e8f0',
              fontWeight: 700,
              fontSize: 12,
              padding: '10px 12px',
              cursor: 'pointer',
            }}
          >
            Ulangi
          </button>
          <button
            type="button"
            onClick={captureImage}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              padding: '10px 12px',
              cursor: 'pointer',
            }}
          >
            Ambil Lagi
          </button>
        </div>
      )}

      {isCapturing && preview && (
        <div style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>
          Foto berhasil ditangkap dan siap dikirim.
        </div>
      )}
    </div>
  );
}
