import Supermemory from 'supermemory';
import type { MemoryItem } from './types';

const client = new Supermemory({
  apiKey: 'sm_jUQNsv3LGJ1GjiaBX54tSh_yZDhLfGadGvbedlDGzSRTWOZvzVbcgcMIRaxbqRAFEVWKkRfKSgkjsryhDXcuSYx'
});

// Sensitive patterns to NEVER store
const SENSITIVE_PATTERNS = [
  /password/i, /passcode/i,
  /otp/i, /verification code/i,
  /api[_\s]?key/i, /secret[_\s]?key/i,
  /wallet/i, /seed[_\s]?phrase/i, /private[_\s]?key/i,
  /credit[_\s]?card/i, /cvv/i, /pin/i,
  /bank[_\s]?account/i, /routing/i,
  /ssn/i, /social[_\s]?security/i,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // credit card numbers
  /\b0x[a-fA-F0-9]{40}\b/, // ethereum addresses
];

// Important content patterns (auto-save these)
const IMPORTANT_PATTERNS = [
  /prefer/i, /like/i, /want/i, /need/i,
  /decided/i, /decision/i, /choose/i,
  /building/i, /project/i, /app/i, /website/i,
  /goal/i, /target/i, /plan/i,
  /always/i, /never/i, /usually/i, /typically/i,
  /remind me/i, /remember/i, /don't forget/i,
  /workflow/i, /process/i, /setup/i,
  /config/i, /setting/i, /option/i,
];

// Casual chat patterns (don't save these)
const CASUAL_PATTERNS = [
  /hello/i, /hi/i, /hey/i,
  /how are you/i, /what's up/i, /how's it going/i,
  /thanks/i, /thank you/i, /ok/i, /okay/i,
  /bye/i, /goodnight/i, /see you/i,
  /lol/i, /haha/i, /😂/,
];

export const memoryRules = {
  // Check if content contains sensitive info
  hasSensitiveInfo: (content: string): boolean => {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(content));
  },

  // Check if content is casual chat
  isCasualChat: (content: string): boolean => {
    // If it's just a greeting or short casual message
    if (content.length < 50 && CASUAL_PATTERNS.some(p => p.test(content))) {
      return true;
    }
    return false;
  },

  // Check if content is important enough to save
  isImportant: (content: string): boolean => {
    if (memoryRules.hasSensitiveInfo(content)) return false;
    if (memoryRules.isCasualChat(content)) return false;
    return IMPORTANT_PATTERNS.some(pattern => pattern.test(content));
  },

  // Check if content is unclear/needs confirmation
  isUnclear: (content: string): boolean => {
    const unclearPatterns = [
      /maybe/i, /possibly/i, /might/i, /could be/i,
      /thinking about/i, /considering/i, /not sure/i,
    ];
    return unclearPatterns.some(p => p.test(content));
  }
};

export const memoryService = {
  // Recall memories - max 3 items
  recall: async (query: string, limit: number = 3): Promise<MemoryItem[]> => {
    try {
      const results = await client.search({ query, limit });
      return results.map((r: any) => ({
        content: r.content,
        metadata: r.metadata,
        score: r.score
      }));
    } catch (error) {
      console.error('Memory recall failed:', error);
      return [];
    }
  },

  // Store memory with rules
  store: async (content: string, tags: string[] = []): Promise<{ success: boolean; reason?: string }> => {
    // Rule: Never store sensitive info
    if (memoryRules.hasSensitiveInfo(content)) {
      return { success: false, reason: 'sensitive_info' };
    }

    // Rule: Don't store casual chat
    if (memoryRules.isCasualChat(content)) {
      return { success: false, reason: 'casual_chat' };
    }

    try {
      await client.add({
        content,
        metadata: {
          tags: [...tags, 'auto-saved'],
          timestamp: new Date().toISOString(),
        }
      });
      return { success: true };
    } catch (error) {
      console.error('Memory store failed:', error);
      return { success: false, reason: 'error' };
    }
  },

  // Ask for confirmation before storing
  shouldAskToSave: (content: string): boolean => {
    if (memoryRules.hasSensitiveInfo(content)) return false;
    if (memoryRules.isCasualChat(content)) return false;
    return memoryRules.isUnclear(content);
  },

  // Summarize long memories to 3 lines
  summarize: (content: string): string => {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 3) return content;
    return sentences.slice(0, 3).join('. ') + '.';
  },

  // Get user profile
  getProfile: async (): Promise<Record<string, any> | null> => {
    try {
      const results = await client.search({ query: 'user profile', limit: 1 });
      if (results.length > 0 && results[0].metadata?.profile) {
        return results[0].metadata.profile;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Update user profile (only for stable long-term info)
  updateProfile: async (profileData: Record<string, any>): Promise<void> => {
    try {
      await client.add({
        content: `User Profile (stable): ${JSON.stringify(profileData)}`,
        metadata: {
          tags: ['profile', 'stable'],
          profile: profileData,
          timestamp: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  }
};

export default memoryService;