export interface PersonalityTraits {
  warmth: number;
  openness: number;
  conscientiousness: number;
  neuroticism: number;
  agreeableness: number;
}

export class PersonalityEngine {
  private userId: string;
  private traits: PersonalityTraits = {
    warmth: 0.5,
    openness: 0.5,
    conscientiousness: 0.5,
    neuroticism: 0.5,
    agreeableness: 0.5,
  };

  constructor(userId: string) {
    this.userId = userId;
  }

  async start(): Promise<void> {
    console.log(`[PersonalityEngine] Started for user: ${this.userId}`);
  }

  async stop(): Promise<void> {
    console.log('[PersonalityEngine] Stopped');
  }

  getTraits(): PersonalityTraits {
    return { ...this.traits };
  }

  updateTrait(key: keyof PersonalityTraits, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.traits[key] = clamped;
    console.log(`[PersonalityEngine] Updated ${key} -> ${clamped}`);
  }

  adapt(feedback: Record<string, number>): void {
    Object.entries(feedback).forEach(([key, delta]) => {
      if (key in this.traits) {
        this.updateTrait(key as keyof PersonalityTraits, this.traits[key as keyof PersonalityTraits] + delta);
      }
    });
  }
}
