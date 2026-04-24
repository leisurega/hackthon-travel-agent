import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const tripApi = {
  createTrip: async (data: { title: string; days: number; budget_total: number }) => {
    const resp = await axios.post(`${API_BASE_URL}/trip`, data);
    return resp.data;
  },
  getTrip: async (tripId: string) => {
    const resp = await axios.get(`${API_BASE_URL}/trip/${tripId}`);
    return resp.data;
  },
  postEvent: async (tripId: string, event: string) => {
    const resp = await axios.post(`${API_BASE_URL}/trip/${tripId}/event`, { event });
    return resp.data;
  }
};
