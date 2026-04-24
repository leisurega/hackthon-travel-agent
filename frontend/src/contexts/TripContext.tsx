import React, { createContext, useContext, useState, useEffect } from 'react';
import { tripApi } from '../api/trip';

interface TripContextType {
  tripId: string | null;
  tripData: any;
  loading: boolean;
  error: string | null;
  refreshTrip: () => Promise<void>;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tripId, setTripId] = useState<string | null>(localStorage.getItem('tripId'));
  const [tripData, setTripData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTripData = async (id: string) => {
    setLoading(true);
    try {
      const data = await tripApi.getTrip(id);
      setTripData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch trip data:', err);
      setError('获取旅行数据失败');
    } finally {
      setLoading(false);
    }
  };

  const initTrip = async () => {
    setLoading(true);
    try {
      // 始终尝试获取当前 tripId 的数据，如果 404 则重新创建
      let currentId = tripId;
      let data = null;
      
      if (currentId) {
        try {
          data = await tripApi.getTrip(currentId);
        } catch (err: any) {
          if (err.response?.status === 404) {
            currentId = null; // 后端重启导致 ID 失效
          } else {
            throw err;
          }
        }
      }

      if (!currentId) {
        const { trip_id } = await tripApi.createTrip({
          title: "意大利与法国浪漫之旅",
          days: 7,
          budget_total: 40000
        });
        currentId = trip_id;
        setTripId(trip_id);
        localStorage.setItem('tripId', trip_id);
        data = await tripApi.getTrip(trip_id);
      }
      
      setTripData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to initialize trip:', err);
      setError('初始化旅行任务失败');
    } finally {
      setLoading(false);
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
    <TripContext.Provider value={{ tripId, tripData, loading, error, refreshTrip }}>
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
