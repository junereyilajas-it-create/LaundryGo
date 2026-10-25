/**
 * LaundriGo Configurable Pricing Rules Module (Frontend)
 */

export const PRICING_VERSION = 'v1.0';
export const BASE_LOAD_LIMIT = 8.0;
export const STANDARD_LOAD_LIMIT = 6.0;
export const RATE_UP_TO_6KG = 160.00;
export const RATE_6_TO_8KG = 180.00;

export interface LoadItem {
  loadNumber: number;
  weight: number;
  price: number;
  description: string;
}

export interface PricingResult {
  measuredWeight: number;
  isOverweight: boolean;
  loadCount: number;
  pricingVersion: string;
  loads: LoadItem[];
  totalAmount: number;
  notice: string;
}

export function calculateLaundryPricing(measuredWeight: number | string): PricingResult {
  const weight = Math.round((typeof measuredWeight === 'number' ? measuredWeight : parseFloat(measuredWeight) || 0) * 100) / 100;

  if (isNaN(weight) || weight <= 0) {
    return {
      measuredWeight: 0,
      isOverweight: false,
      loadCount: 1,
      pricingVersion: PRICING_VERSION,
      loads: [{ loadNumber: 1, weight: 0, price: RATE_UP_TO_6KG, description: '0 kg load' }],
      totalAmount: RATE_UP_TO_6KG,
      notice: 'Standard single load (up to 6 kg)'
    };
  }

  // 1. Single load up to 6 kg
  if (weight <= STANDARD_LOAD_LIMIT) {
    return {
      measuredWeight: weight,
      isOverweight: false,
      loadCount: 1,
      pricingVersion: PRICING_VERSION,
      loads: [
        {
          loadNumber: 1,
          weight: weight,
          price: RATE_UP_TO_6KG,
          description: `${weight} kg load`
        }
      ],
      totalAmount: RATE_UP_TO_6KG,
      notice: 'Standard single load (up to 6 kg)'
    };
  }

  // 2. Single load between 6.01 kg and 8 kg
  if (weight <= BASE_LOAD_LIMIT) {
    return {
      measuredWeight: weight,
      isOverweight: false,
      loadCount: 1,
      pricingVersion: PRICING_VERSION,
      loads: [
        {
          loadNumber: 1,
          weight: weight,
          price: RATE_6_TO_8KG,
          description: `${weight} kg load`
        }
      ],
      totalAmount: RATE_6_TO_8KG,
      notice: 'Standard single load (6 kg - 8 kg)'
    };
  }

  // 3. Overweight (> 8 kg): divide into multiple loads (max 8 kg each)
  const numLoads = Math.ceil(weight / BASE_LOAD_LIMIT);
  const heavyCount = Math.max(0, Math.min(numLoads, Math.ceil((weight - STANDARD_LOAD_LIMIT * numLoads) / 2)));
  const standardCount = numLoads - heavyCount;

  const loads: LoadItem[] = [];
  let remainingWeight = weight;

  for (let i = 0; i < heavyCount; i++) {
    let allocatedWeight: number;
    if (standardCount === 0) {
      const countLeft = heavyCount - i;
      allocatedWeight = Math.round((remainingWeight / countLeft) * 100) / 100;
    } else {
      const minNeededForHeavy = Math.max(6.01, Math.round((remainingWeight - standardCount * STANDARD_LOAD_LIMIT) * 100) / 100);
      allocatedWeight = Math.min(BASE_LOAD_LIMIT, Math.max(minNeededForHeavy, 8.0));
    }

    if (allocatedWeight > BASE_LOAD_LIMIT) allocatedWeight = BASE_LOAD_LIMIT;
    remainingWeight = Math.round((remainingWeight - allocatedWeight) * 100) / 100;

    loads.push({
      loadNumber: loads.length + 1,
      weight: allocatedWeight,
      price: RATE_6_TO_8KG,
      description: `${allocatedWeight} kg load`
    });
  }

  for (let i = 0; i < standardCount; i++) {
    const isLast = (i === standardCount - 1);
    let allocatedWeight: number;
    if (isLast) {
      allocatedWeight = Math.round(remainingWeight * 100) / 100;
    } else {
      const countLeft = standardCount - i;
      allocatedWeight = Math.round((remainingWeight / countLeft) * 100) / 100;
      if (allocatedWeight > STANDARD_LOAD_LIMIT) allocatedWeight = STANDARD_LOAD_LIMIT;
    }

    remainingWeight = Math.round((remainingWeight - allocatedWeight) * 100) / 100;

    loads.push({
      loadNumber: loads.length + 1,
      weight: allocatedWeight,
      price: RATE_UP_TO_6KG,
      description: `${allocatedWeight} kg load`
    });
  }

  let sumWeights = loads.reduce((acc, l) => acc + l.weight, 0);
  const diff = Math.round((weight - sumWeights) * 100) / 100;
  if (Math.abs(diff) > 0 && loads.length > 0) {
    loads[loads.length - 1].weight = Math.round((loads[loads.length - 1].weight + diff) * 100) / 100;
    loads[loads.length - 1].description = `${loads[loads.length - 1].weight} kg load`;
  }

  loads.forEach(l => {
    l.price = l.weight <= STANDARD_LOAD_LIMIT ? RATE_UP_TO_6KG : RATE_6_TO_8KG;
  });

  const totalAmount = loads.reduce((sum, l) => sum + l.price, 0);

  return {
    measuredWeight: weight,
    isOverweight: true,
    loadCount: loads.length,
    pricingVersion: PRICING_VERSION,
    loads: loads,
    totalAmount: totalAmount,
    notice: `Your laundry weighs ${weight} kg (exceeds 8 kg limit). Divided into ${loads.length} loads for customer approval.`
  };
}
