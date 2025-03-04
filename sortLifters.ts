const fs = require('fs');

// Define the interfaces
interface LiftResult {
    lifter: string;
    bodyWeight: number;
    snatch: number;
    cj: number;
    total: number;
}

interface WeightliftingEntry {
    name: string;
    weightCategory: string;
    entryTotal: string;
}

interface CombinedResult {
    lifter: string;
    weightCategory: string;
    entryTotal: number;
    bestSnatch: number;
    bestCJ: number;
    bestTotal: number;
}

// Read both files
const liftingDataFile = fs.readFileSync('24_results.ts', 'utf8');
const entriesFile = fs.readFileSync('ao125_entries.ts', 'utf8');

// Extract entries data
const entriesStart = entriesFile.indexOf('export const entries: WeightliftingEntry[] = [');
const entriesContent = entriesFile.slice(
    entriesFile.indexOf('[', entriesStart),
    entriesFile.lastIndexOf(']') + 1
);
const entries = eval(entriesContent) as WeightliftingEntry[];

// Create a Map of entries for lookup with additional data
const entriesMap = new Map(entries.map(entry => [
    entry.name,
    { weightCategory: entry.weightCategory, entryTotal: parseInt(entry.entryTotal) }
]));

// Extract lifting results data
const arrayStart = liftingDataFile.indexOf('export const liftingResults: LiftResult[] = [');
const startBracket = liftingDataFile.indexOf('[', arrayStart);
const endBracket = liftingDataFile.lastIndexOf(']');
const arrayContent = liftingDataFile.slice(startBracket, endBracket + 1);

// Convert the content to a JavaScript array using eval
const liftingResults = eval(arrayContent) as LiftResult[];

// Helper function to parse weight category for sorting
function parseWeightCategory(category: string): { gender: string; weight: number; isPlus: boolean } {
    const gender = category.startsWith('Female') ? 'Female' : 'Male';
    const weightStr = category.replace('Female ', '').replace('Male ', '');
    const isPlus = weightStr.startsWith('+');
    const weight = parseFloat(weightStr.replace('kg', '').replace('+', ''));
    return { gender, weight, isPlus };
}

// Custom comparison function for weight categories
function compareWeightCategories(a: string, b: string): number {
    const catA = parseWeightCategory(a);
    const catB = parseWeightCategory(b);

    // First sort by gender (Female before Male)
    if (catA.gender !== catB.gender) {
        return catA.gender === 'Female' ? -1 : 1;
    }

    // Then sort by weight
    if (catA.weight !== catB.weight) {
        return catA.weight - catB.weight;
    }

    // If weights are equal, non-plus comes before plus
    if (catA.isPlus !== catB.isPlus) {
        return catA.isPlus ? 1 : -1;
    }

    return 0;
}

// Group by lifter and get highest values, but only for lifters in entries
const bestLifts = Object.values(liftingResults.reduce((acc, curr) => {
    // Only process if the lifter is in the entries file
    if (entriesMap.has(curr.lifter)) {
        const entryData = entriesMap.get(curr.lifter)!;
        if (!acc[curr.lifter]) {
            acc[curr.lifter] = {
                lifter: curr.lifter,
                weightCategory: entryData.weightCategory,
                entryTotal: entryData.entryTotal,
                bestSnatch: curr.snatch,
                bestCJ: curr.cj,
                bestTotal: curr.total
            };
        } else {
            acc[curr.lifter].bestSnatch = Math.max(acc[curr.lifter].bestSnatch, curr.snatch);
            acc[curr.lifter].bestCJ = Math.max(acc[curr.lifter].bestCJ, curr.cj);
            acc[curr.lifter].bestTotal = Math.max(acc[curr.lifter].bestTotal, curr.total);
        }
    }
    return acc;
}, {} as Record<string, CombinedResult>));

// Sort the array
const sortedResults = bestLifts.sort((a, b) => {
    // First sort by weight category
    const categoryComparison = compareWeightCategories(a.weightCategory, b.weightCategory);
    if (categoryComparison !== 0) {
        return categoryComparison;
    }
    
    // If in same category, sort by entryTotal
    if (a.entryTotal !== b.entryTotal) {
        return a.entryTotal - b.entryTotal;
    }
    
    // If entryTotals are equal, sort by name
    return a.lifter.localeCompare(b.lifter);
});

// Format each entry on a single line
const formattedEntries = sortedResults
    .map(entry => `  { lifter: "${entry.lifter}", weightCategory: "${entry.weightCategory}", entryTotal: ${entry.entryTotal}, bestSnatch: ${entry.bestSnatch}, bestCJ: ${entry.bestCJ}, bestTotal: ${entry.bestTotal} }`)
    .join(',\n');

// Create the new file content with updated interface
const newContent = `// Generated by weightlifting scraper
// Last updated: 2025-01-01T14:42:21.579Z

export interface LiftResult {
    lifter: string;
    weightCategory: string;
    entryTotal: number;
    bestSnatch: number;
    bestCJ: number;
    bestTotal: number;
}

export const liftingResults: LiftResult[] = [\n${formattedEntries}\n];`;

// Write the sorted content back to a file
fs.writeFileSync('ao125_sorted.ts', newContent);

console.log('File has been sorted and saved'); 