import React, { createContext, useContext, useState } from 'react';

const TourContext = createContext(null);

export const TourProvider = ({ children }) => {
  const [tourActive, setTourActive] = useState(false);

  const startTour = () => setTourActive(true);
  const stopTour  = () => setTourActive(false);

  return (
    <TourContext.Provider value={{ tourActive, startTour, stopTour }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => useContext(TourContext);

