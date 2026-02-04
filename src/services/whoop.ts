import type { WhoopData } from '../types';

export interface WhoopServiceInterface {
  getCurrentData(): Promise<WhoopData>;
  getHistoricalData(days: number): Promise<WhoopData[]>;
}

// Mock implementation for now
// Later, replace with real API via Netlify Function
class MockWhoopService implements WhoopServiceInterface {
  async getCurrentData(): Promise<WhoopData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      sleepScore: 85,
      hrv: 62,
      restingHR: 48,
      strain: 12.5,
      recovery: 78
    };
  }

  async getHistoricalData(days: number): Promise<WhoopData[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return Array.from({ length: days }, () => ({
      sleepScore: 70 + Math.floor(Math.random() * 25),
      hrv: 45 + Math.floor(Math.random() * 30),
      restingHR: 45 + Math.floor(Math.random() * 15),
      strain: 8 + Math.random() * 12,
      recovery: 60 + Math.floor(Math.random() * 35)
    }));
  }
}

// Future: Netlify Function proxy implementation
// class RealWhoopService implements WhoopServiceInterface {
//   private baseUrl = '/.netlify/functions/whoop-proxy';
//   
//   async getCurrentData(): Promise<WhoopData> {
//     const response = await fetch(`${this.baseUrl}/current`);
//     return response.json();
//   }
//   
//   async getHistoricalData(days: number): Promise<WhoopData[]> {
//     const response = await fetch(`${this.baseUrl}/historical?days=${days}`);
//     return response.json();
//   }
// }

export const whoopService: WhoopServiceInterface = new MockWhoopService();