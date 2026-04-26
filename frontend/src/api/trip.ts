import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const tripApi = {
  createTrip: async (data: { title: string; start_date: string; days: number; budget_total: number; cities?: string[]; member_ids?: string[] }) => {
    const resp = await axios.post(`${API_BASE_URL}/trip`, data);
    return resp.data;
  },
  getTrip: async (tripId: string) => {
    const resp = await axios.get(`${API_BASE_URL}/trip/${tripId}`);
    return resp.data;
  },
  getToday: async (tripId: string) => {
    const resp = await axios.get(`${API_BASE_URL}/trip/${tripId}/today`);
    return resp.data;
  },
  getEventTypes: async () => {
    const resp = await axios.get(`${API_BASE_URL}/event-types`);
    return resp.data;
  },
  postEvent: async (tripId: string, payload: { type: string; params: any; occurs_on_day?: number }) => {
    const resp = await axios.post(`${API_BASE_URL}/trip/${tripId}/event`, payload);
    return resp.data;
  },
  replay: async (tripId: string) => {
    const resp = await axios.post(`${API_BASE_URL}/trip/${tripId}/replay`);
    return resp.data;
  },
  replan: async (tripId: string) => {
    const resp = await axios.post(`${API_BASE_URL}/trip/${tripId}/replan`);
    return resp.data;
  },
  adopt: async (tripId: string) => {
    const resp = await axios.post(`${API_BASE_URL}/trip/${tripId}/adopt`);
    return resp.data;
  },
  reEvaluate: async (tripId: string) => {
    const resp = await axios.post(`${API_BASE_URL}/trip/${tripId}/re-evaluate`);
    return resp.data;
  }
};

export const profileApi = {
  list: async () => {
    const resp = await axios.get(`${API_BASE_URL}/profiles`);
    return resp.data;
  },
  get: async (userId: string) => {
    const resp = await axios.get(`${API_BASE_URL}/profiles/${userId}`);
    return resp.data;
  },
  create: async (profile: any) => {
    const resp = await axios.post(`${API_BASE_URL}/profiles`, profile);
    return resp.data;
  },
  update: async (userId: string, profile: any) => {
    const resp = await axios.put(`${API_BASE_URL}/profiles/${userId}`, profile);
    return resp.data;
  },
  delete: async (userId: string) => {
    const resp = await axios.delete(`${API_BASE_URL}/profiles/${userId}`);
    return resp.data;
  }
};
