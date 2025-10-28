// frontend-new/src/api.js
import axios from "axios";

// Try relative first (works with CRA proxy in dev). If the backend isn't reachable
// (404 or HTML response), fall back to the explicit backend address used in dev.
const BACKEND_FALLBACK = "http://127.0.0.1:5000";
const timeout = 7000;

async function tryRequest(method, path, data = null, config = {}) {
  // try relative
  try {
    const res = await axios({ method, url: path, data, timeout, ...config });
    return res;
  } catch (err) {
    // If error has a response and it looks like HTML or 404, try fallback backend address
    const resp = err && err.response;
    const contentType = resp && resp.headers && resp.headers['content-type'];
    if (resp && (resp.status === 404 || (contentType && contentType.indexOf('text/html') !== -1))) {
      // retry against explicit backend URL
      const full = BACKEND_FALLBACK + path;
      const res2 = await axios({ method, url: full, data, timeout, ...config });
      return res2;
    }
    // else rethrow original error
    throw err;
  }
}

export const getMilestones = async (projectId) => {
  const res = await tryRequest('get', `/api/milestones?project_id=${projectId}`);
  return res.data;
};

export const createMilestone = async (payload) => {
  const res = await tryRequest('post', `/api/milestones`, payload, { headers: { 'Content-Type': 'application/json' } });
  return res.data;
};

export const updateMilestone = async (id, payload) => {
  const res = await tryRequest('put', `/api/milestones/${id}`, payload, { headers: { 'Content-Type': 'application/json' } });
  return res.data;
};

export const deleteMilestone = async (id) => {
  const res = await tryRequest('delete', `/api/milestones/${id}`);
  return res.data;
};

const api = {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
};

export default api;
