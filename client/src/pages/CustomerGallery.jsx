import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

export default function CustomerGallery() {
  const { slug } = useParams();

  const [eventName, setEventName] = useState('');
  const [pin, setPin] = useState('');
  const [photos, setPhotos] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null); // index into `photos`, or null if closed

  useEffect(() => {
    checkGallery();
  }, [slug]);

  async function checkGallery() {
    setLoading(true);
    try {
      const res = await api.get(`/public/galleries/${slug}`);
      setEventName(res.data.eventName);
    } catch (err) {
      setError(err.response?.data?.error || 'Gallery not found');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyPin(e) {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const res = await api.post(`/public/galleries/${slug}/verify-pin`, { pin });
      setPhotos(res.data.photos);
      setEventName(res.data.eventName);
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect PIN');
    } finally {
      setVerifying(false);
    }
  }

  function showNextPhoto() {
    setLightboxIndex((i) => (i + 1) % photos.length);
  }

  function showPrevPhoto() {
    setLightboxIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading...</div>;
  if (error && !photos && !eventName) {
    return <div className="min-h-screen flex items-center justify-center text-red-600 text-sm">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8 text-center">{eventName}</h1>

        {photos === null && (
          <div className="max-w-sm mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <p className="text-sm text-gray-600 text-center">Enter the PIN to view photos</p>
              <input
                placeholder="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <button
                type="submit"
                disabled={verifying}
                className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {verifying ? 'Checking...' : 'View Gallery'}
              </button>
            </form>
          </div>
        )}

        {photos !== null && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="rounded-lg overflow-hidden aspect-square bg-white shadow-sm cursor-pointer group"
                onClick={() => setLightboxIndex(index)}
              >
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-full object-cover transition group-hover:scale-105"
                />
              </div>
            ))}
            {photos.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center">No photos in this gallery.</p>}
          </div>
        )}
      </div>

      {lightboxIndex !== null && photos && photos[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); showPrevPhoto(); }}
            className="absolute left-4 text-white text-4xl leading-none hover:opacity-70 px-2"
          >
            &#8249;
          </button>

          <img
            src={photos[lightboxIndex].url}
            alt=""
            className="max-w-full max-h-[85vh] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={(e) => { e.stopPropagation(); showNextPhoto(); }}
            className="absolute right-4 text-white text-4xl leading-none hover:opacity-70 px-2"
          >
            &#8250;
          </button>

          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:opacity-70"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}