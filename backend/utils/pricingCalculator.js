/**
 * LaundriGo Configurable Pricing Rules Module (v1.0)
 * 
 * Rules:
 * - Load up to 6 kg: ₱160
 * - Load > 6 kg and up to 8 kg: ₱180
 * - Weight > 8 kg: Must be divided into multiple loads (each max 8 kg).
 *   Requires customer approval before processing.
 * 
 * Allocation formula:
 * Optimizes load distribution to minimize customer cost while respecting the 8 kg maximum load limit.
 */

const PRICING_VERSION = 'v1.0';
const BASE_LOAD_LIMIT = 8.0;
const STANDARD_LOAD_LIMIT = 6.0;
const RATE_UP_TO_6KG = 160.00;
const RATE_6_TO_8KG = 180.00;

function calculateLaundryPricing(measuredWeight) {
    const weight = Math.round(parseFloat(measuredWeight) * 100) / 100;

    if (isNaN(weight) || weight <= 0) {
        throw new Error('Weight must be a positive numeric value greater than zero.');
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
    
    // Determine minimum number of 8kg loads needed so that the rest are <= 6kg
    // Capacity with x 8kg loads and (numLoads - x) 6kg loads is: 6*numLoads + 2*x
    const heavyCount = Math.max(0, Math.min(numLoads, Math.ceil((weight - STANDARD_LOAD_LIMIT * numLoads) / 2)));
    const standardCount = numLoads - heavyCount;

    const loads = [];
    let remainingWeight = weight;

    // Allocate heavy loads: pack as much into 8kg loads as needed so remaining weight / standardCount <= 6.0
    for (let i = 0; i < heavyCount; i++) {
        let allocatedWeight;
        if (standardCount === 0) {
            const countLeft = heavyCount - i;
            allocatedWeight = Math.round((remainingWeight / countLeft) * 100) / 100;
        } else {
            // We want remainingWeight after this load to be <= standardCount * 6.0
            // so allocatedWeight >= remainingWeight - standardCount * 6.0
            // and allocatedWeight <= 8.0
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

    // Allocate standard loads (each <= 6kg)
    for (let i = 0; i < standardCount; i++) {
        const isLast = (i === standardCount - 1);
        let allocatedWeight;
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

    // Clean up precision to ensure sum(loads.weight) == weight exactly
    let sumWeights = loads.reduce((acc, l) => acc + l.weight, 0);
    const diff = Math.round((weight - sumWeights) * 100) / 100;
    if (Math.abs(diff) > 0 && loads.length > 0) {
        loads[loads.length - 1].weight = Math.round((loads[loads.length - 1].weight + diff) * 100) / 100;
        loads[loads.length - 1].description = `${loads[loads.length - 1].weight} kg load`;
    }

    // Recalculate price per load strictly based on load's final weight
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
        notice: `Your laundry weighs ${weight} kg (exceeds 8 kg limit). Proposed into ${loads.length} loads for customer approval.`
    };
}

module.exports = {
    calculateLaundryPricing,
    PRICING_VERSION,
    BASE_LOAD_LIMIT,
    STANDARD_LOAD_LIMIT,
    RATE_UP_TO_6KG,
    RATE_6_TO_8KG
};
