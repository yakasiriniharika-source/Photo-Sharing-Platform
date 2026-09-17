import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [newEventName, setNewEventName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

useEffect(() => {
  loadEvents();
}, []);

async function loadEvents() {
  setLoading(true);
  await fetchEvents();
  setLoading(false);
}

async function fetchEvents() {
  try {
    const res = await api.get('/events');
    setEvents(res.data);
  } catch (err) {
    setError('Failed to load events');
  }
}
  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/events', { name: newEventName });
      setNewEventName('');
      await fetchEvents(); // targeted refresh — no full-page "Loading..." flash
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create event');
    }
  }

  async function handleRename(eventId) {
    setError('');
    try {
      await api.patch(`/events/${eventId}`, { name: editName });
      setEditingId(null);
      await fetchEvents();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to rename event');
    }
  }

  async function handleDelete(eventId) {
    if (!confirm('Delete this event? This will permanently delete all its photos and gallery.')) return;
    setError('');
    try {
      await api.delete(`/events/${eventId}`);
      await fetchEvents();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete event');
    }
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        {user.role === 'ADMIN' ? 'Your Events' : 'Assigned Events'}
      </h1>

      {user.role === 'ADMIN' && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-8">
          <input
            placeholder="New event name"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
          >
            Create Event
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:shadow-sm transition"
          >
            {editingId === event.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  autoFocus
                />
                <button
                  onClick={() => handleRename(event.id)}
                  className="text-sm px-3 py-1 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <Link to={`/events/${event.id}`} className="flex-1 text-gray-900 font-medium">
                  {event.name}
                </Link>
                {user.role === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => { setEditingId(event.id); setEditName(event.name); }}
                      className="text-sm px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-md transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded-md transition"
                    >
                      Delete
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {events.length === 0 && (
        <p className="text-sm text-gray-400 mt-4">No events yet.</p>
      )}
    </div>
  );
}