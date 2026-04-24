import React, { createContext, useContext, useState, useEffect } from 'react';
import { tripApi } from '../api/trip';

interface TripContextType {
  tripId: string | null;
  setTripId: (id: string | null) => void;
  selectedMemberIds: string[];
  setSelectedMemberIds: (ids: string[]) => void;
  tripData: any;
  setTripData: (data: any) => void;
  loading: boolean;
  error: string | null;
  refreshTrip: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tripId, setTripIdState] = useState<string | null>(localStorage.getItem('tripId'));
  const [selectedMemberIds, setSelectedMemberIdsState] = useState<string[]>(() => {
    const saved = localStorage.getItem('selectedMemberIds');
    return saved ? JSON.parse(saved) : ['A', 'B', 'C', 'D'];
  });
  const [tripData, setTripData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTripId = (id: string | null) => {
    setTripIdState(id);
    if (id) {
      localStorage.setItem('tripId', id);
    } else {
      localStorage.removeItem('tripId');
      setTripData(null);
    }
  };

  const setSelectedMemberIds = (ids: string[]) => {
    setSelectedMemberIdsState(ids);
    localStorage.setItem('selectedMemberIds', JSON.stringify(ids));
  };

  const fetchTripData = async (id: string) => {
    setLoading(true);
    try {
      const data = await tripApi.getTrip(id);
      setTripData(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch trip data:', err);
      if (err.response?.status === 404) {
        setTripId(null);
        setError('当前旅行任务已失效，请重新创建');
      } else {
        setError('获取旅行数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const initTrip = async () => {
    if (tripId) {
      await fetchTripData(tripId);
    }
  };

  useEffect(() => {
    initTrip();
  }, []);

  const refreshTrip = async () => {
    if (tripId) {
      await fetchTripData(tripId);
    }
  };

  return (
    <TripContext.Provider value={{ 
      tripId, 
      setTripId, 
      selectedMemberIds, 
      setSelectedMemberIds, 
      tripData, 
      setTripData,
      loading, 
      error, 
      refreshTrip 
    }}>
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = () => {
  const context = useContext(TripContext);
  if (context === undefined) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
};
