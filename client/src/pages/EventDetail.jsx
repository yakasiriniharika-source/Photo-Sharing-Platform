import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(''); // page-load failure only
  const [memberError, setMemberError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [galleryError, setGalleryError] = useState('');
  const [loading, setLoading] = useState(true);

  const [gallery, setGallery] = useState(null);
  const [pin, setPin] = useState('');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());
  const [publishing, setPublishing] = useState(false);
  const [updatingSelection, setUpdatingSelection] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(''); // '' | 'updated', transient
  const [lightboxIndex, setLightboxIndex] = useState(null); // index into `photos`, or null if closed
  const [copyStatus, setCopyStatus] = useState(''); // '' | 'copied' | 'failed', transient

useEffect(() => {
  loadAll();
}, [id]);

async function loadAll() {
  setLoading(true);
  await fetchData();
  setLoading(false);
}

async function fetchData() {
  try {
    const [eventRes, membersRes, photosRes] = await Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/members`),
      api.get(`/events/${id}/photos`),
    ]);
    setEvent(eventRes.data);
    setMembers(membersRes.data);
    setPhotos(photosRes.data);

    if (user.role === 'ADMIN') {
      try {
        const galleryRes = await api.get(`/events/${id}/gallery`);
        setGallery(galleryRes.data);
        setSelectedPhotoIds(new Set(galleryRes.data.photoIds));
      } catch (err) {
        if (err.response?.status !== 404) throw err;
        setGallery(null);
      }
    }
  } catch (err) {
    setError(err.response?.data?.error || 'Failed to load event');
  }
}

// Lightweight, targeted refreshes for after a mutation — no `loading` toggle,
// so the whole page doesn't unmount and flash back to "Loading...".
async function refreshMembers() {
  const res = await api.get(`/events/${id}/members`);
  setMembers(res.data);
}

async function refreshPhotos() {
  const res = await api.get(`/events/${id}/photos`);
  setPhotos(res.data);
  return res.data;
}

  async function handleAddMember(e) {
    e.preventDefault();
    setMemberError('');
    try {
      await api.post(`/events/${id}/members`, { email: newMemberEmail });
      setNewMemberEmail('');
      await refreshMembers();
    } catch (err) {
      setMemberError(err.response?.data?.error || 'Failed to add member');
    }
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    setUploading(true);
    setPhotoError('');
    try {
      await api.post(`/events/${id}/photos`, formData);
      await refreshPhotos();
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function togglePhotoSelection(photoId) {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  async function handlePublishGallery(e) {
    e.preventDefault();
    setGalleryError('');

    if (selectedPhotoIds.size === 0) {
      setGalleryError('Select at least one photo before publishing.');
      return;
    }

    setPublishing(true);
    try {
      // Step 1: create the gallery shell (with PIN) if one doesn't exist yet
      let galleryId = gallery?.id;
      if (!galleryId) {
        const created = await api.post(`/events/${id}/gallery`, { pin });
        galleryId = created.data.id;
      }

      // Step 2: attach the selected photos
      await api.patch(`/galleries/${galleryId}/photos`, {
        photoIds: Array.from(selectedPhotoIds),
      });

      // Step 3: publish, which returns the final slug + link
      const published = await api.post(`/galleries/${galleryId}/publish`);
      setGallery({
        id: galleryId,
        slug: published.data.slug,
        published: published.data.published,
        photoIds: Array.from(selectedPhotoIds),
      });
    } catch (err) {
      setGalleryError(err.response?.data?.error || 'Failed to publish gallery');
    } finally {
      setPublishing(false);
    }
  }

  // Once a gallery is published, this lets the Admin keep syncing the selection
  // (e.g. include photos uploaded after publishing) without changing the link/PIN.
  async function handleUpdateGalleryPhotos() {
    setGalleryError('');

    if (selectedPhotoIds.size === 0) {
      setGalleryError('Select at least one photo to keep in the gallery.');
      return;
    }

    setUpdatingSelection(true);
    try {
      await api.patch(`/galleries/${gallery.id}/photos`, {
        photoIds: Array.from(selectedPhotoIds),
      });
      setGallery((prev) => ({ ...prev, photoIds: Array.from(selectedPhotoIds) }));
      setUpdateStatus('updated');
    } catch (err) {
      setGalleryError(err.response?.data?.error || 'Failed to update gallery photos');
    } finally {
      setUpdatingSelection(false);
      setTimeout(() => setUpdateStatus(''), 2000);
    }
  }

  function getGalleryLink() {
    return `${window.location.origin}/gallery/${gallery.slug}`;
  }

  async function handleCopyLink() {
    const link = getGalleryLink();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        // Fallback for non-secure contexts / older browsers
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyStatus('copied');
    } catch (err) {
      setCopyStatus('failed');
    } finally {
      setTimeout(() => setCopyStatus(''), 2000);
    }
  }

  async function handleDeletePhoto(photoId) {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setPhotoError('');
    try {
      await api.delete(`/photos/${photoId}`);
      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
      await refreshPhotos();
    } catch (err) {
      setPhotoError(err.response?.data?.error || 'Failed to delete photo');
    }
  }

  function showNextPhoto() {
    setLightboxIndex((i) => (i + 1) % photos.length);
  }

  function showPrevPhoto() {
    setLightboxIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  // Compares the current checkbox selection against what's actually saved on
  // the gallery, so the "Update Gallery" button only lights up when relevant.
  const savedPhotoIds = new Set(gallery?.photoIds || []);
  const hasUnsavedChanges =
    gallery?.published &&
    (selectedPhotoIds.size !== savedPhotoIds.size ||
      Array.from(selectedPhotoIds).some((pid) => !savedPhotoIds.has(pid)));

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 text-sm">Loading...</div>;
  if (error && !event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-600 text-sm">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{event.name}</h1>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Team Members</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {members.map((m) => (
              <span key={m.id} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                {m.user.name}
              </span>
            ))}
          </div>
          {members.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">No team members yet.</p>
          )}

          {user.role === 'ADMIN' && (
            <>
              <form onSubmit={handleAddMember} className="flex gap-2 max-w-sm">
                <input
                  type="email"
                  placeholder="Team member's email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition whitespace-nowrap">
                  Add
                </button>
              </form>
              {memberError && <p className="text-sm text-red-600 mt-2">{memberError}</p>}
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Photos</h2>
            {user.role === 'MEMBER' && (
              <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 cursor-pointer transition">
                {uploading ? 'Uploading...' : '+ Upload Photos'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {user.role === 'ADMIN' && photos.length > 0 && (
            <p className="text-xs text-gray-500 mb-3">
              Tick the photos to include in the gallery — {selectedPhotoIds.size} selected
              {gallery?.published && ' (you can keep updating this after publishing)'}
            </p>
          )}

          {photoError && <p className="text-sm text-red-600 mb-4">{photoError}</p>}

          {photos.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
              <p className="text-4xl mb-2">🖼️</p>
              <p className="text-sm text-gray-400">
                {user.role === 'ADMIN' ? 'No photos uploaded yet — waiting on the team.' : 'No photos uploaded yet'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo, index) => {
                const selectable = user.role === 'ADMIN';
                return (
                  <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-square">
                    <img
                      src={photo.storageUrl}
                      alt={photo.filename}
                      className="w-full h-full object-cover cursor-pointer transition group-hover:scale-105"
                      onClick={() => setLightboxIndex(index)}
                    />
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={selectedPhotoIds.has(photo.id)}
                        onChange={() => togglePhotoSelection(photo.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 left-2 w-5 h-5 accent-gray-900"
                      />
                    )}
                    {user.role === 'ADMIN' && photo.uploader && (
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded-md">
                        {photo.uploader.name}
                      </span>
                    )}
                    {user.role === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white text-sm opacity-0 group-hover:opacity-100 hover:bg-red-600 transition"
                        title="Delete photo"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {user.role === 'ADMIN' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Gallery</h2>

            {galleryError && <p className="text-sm text-red-600 mb-4">{galleryError}</p>}

            {gallery && gallery.published ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-2">✅ Published</p>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm text-gray-700">
                    Link: <code className="bg-white px-2 py-0.5 rounded border border-gray-200 text-xs">
                      {getGalleryLink()}
                    </code>
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    {copyStatus === 'copied' ? 'Copied!' : copyStatus === 'failed' ? 'Copy failed' : 'Copy'}
                  </button>
                </div>
                {pin ? (
                  <p className="text-sm text-gray-700">PIN: <span className="font-mono font-medium">{pin}</span></p>
                ) : (
                  <p className="text-xs text-gray-400 italic">PIN was set when this gallery was created and can't be retrieved again — check your own records.</p>
                )}

                <div className="mt-4 pt-4 border-t border-green-200 flex items-center gap-3 flex-wrap">
                  <p className="text-xs text-gray-500">
                    {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'} currently selected
                    {hasUnsavedChanges && <span className="text-amber-600 font-medium"> — unsaved changes</span>}
                  </p>
                  <button
                    type="button"
                    onClick={handleUpdateGalleryPhotos}
                    disabled={updatingSelection || !hasUnsavedChanges}
                    className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {updatingSelection ? 'Updating...' : updateStatus === 'updated' ? 'Updated!' : 'Update Gallery'}
                  </button>
                </div>
              </div>
            ) : photos.length === 0 ? (
              <p className="text-sm text-gray-400">Waiting on the team to upload photos before you can build a gallery.</p>
            ) : (
              <form onSubmit={handlePublishGallery} className="flex gap-2 max-w-sm">
                <input
                  placeholder="Set a PIN (4-8 digits)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="submit"
                  disabled={publishing || selectedPhotoIds.size === 0}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition whitespace-nowrap"
                >
                  {publishing ? 'Publishing...' : 'Publish Gallery'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {lightboxIndex !== null && photos[lightboxIndex] && (
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
            src={photos[lightboxIndex].storageUrl}
            alt={photos[lightboxIndex].filename}
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