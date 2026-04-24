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
    if (tripId) {
      await fetchTripData(tripId);
    } else {
      setLoading(true);
      try {
        const { trip_id } = await tripApi.createTrip({
          title: "意大利与法国浪漫之旅",
          days: 7,
          budget_total: 40000
        });
        setTripId(trip_id);
        localStorage.setItem('tripId', trip_id);
        await fetchTripData(trip_id);
      } catch (err) {
        console.error('Failed to create initial trip:', err);
        setError('创建初始旅行任务失败');
      } finally {
        setLoading(false);
      }
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
