# Receptor-Ligand Co-expression Visualizer

## Overview
This web application allows users to explore and visualize expression profiles of receptors and their corresponding ligands (or vice versa) using data from the Human Protein Atlas. Users can input either a gene name or UniProt ID to discover co-expression patterns and visualize tissue and cell-type specific expression profiles.

## Try it out!
https://coexpression-visualizer-demo-7m71.vercel.app/

## Features

### Search Functionality
- **Gene Name Search**: Enter a gene name (e.g., "AGTR2") to find its expression profile
- **UniProt ID Search**: Alternatively, enter a UniProt ID (e.g., "P50052") for direct access
- **Flexible Input**: Works for both receptors and ligands

### Expression Profile Analysis
- **Comprehensive Expression Data**:
  - Tissue-specific expression levels (nTPM values)
  - Single-cell type expression patterns
  - Interactive visualization of expression profiles
  
- **Co-expression Analysis**:
  - Automatic identification of receptor-ligand pairs
  - Pearson correlation ranking of pairs
  - Visualization of co-expression patterns

### Visualization Features
- **Expression Profile Plots**:
  - Bar plots showing tissue-specific expression
  - Cell-type specific expression patterns
  - Interactive data exploration
  
- **Correlation Analysis**:
  - Ranked list of receptor-ligand pairs by correlation
  - Side-by-side comparison of expression profiles
  - Correlation metrics and statistics

## How It Works

### For Receptor Input:
1. Enter a receptor gene name or UniProt ID
2. The app will:
   - Fetch the receptor's expression profile
   - Identify all corresponding ligands
   - Calculate correlation scores
   - Display ranked ligands by correlation strength
   - Generate expression profile plots for receptor and top ligands

### For Ligand Input:
1. Enter a ligand gene name or UniProt ID
2. The app will:
   - Fetch the ligand's expression profile
   - Find all corresponding receptors
   - Calculate correlation scores
   - Display ranked receptors by correlation strength
   - Generate expression profile plots for ligand and top receptors

### Expression Metrics
The app calculates several co-expression features:
- Pearson correlation
- Cosine similarity
- Jaccard index
- Expression overlap analysis
- Shared top 10 expression sites

## Data Sources and Management

### Primary Data Sources
- **Expression Data**: Human Protein Atlas API
  - Tissue RNA expression (nTPM values)
  - Single-cell RNA expression data
  - Comprehensive coverage of human tissues and cell types
- **Receptor-Ligand Pairs**: `bm_update_3_subset_rec_lig_pairs.csv`
  - Curated receptor-ligand interaction pairs
  - Maps gene names to UniProt IDs

### MongoDB Integration
- **Temporary Collections**:
  - `expression_cache`: Stores expression profiles with TTL
  - `receptor_ligand_pairs`: Stores parsed CSV data
- **Automatic Cleanup**:
  - Expression data expires after 1 hour
  - Prevents database size limit issues
  - Fresh data fetched when needed

### Data Flow
1. User inputs receptor/ligand name
2. System queries MongoDB for relationship data
3. Expression profiles fetched and cached
4. Results displayed to user
5. Cached data automatically cleaned up

## Technical Details
- Built using Next.js and TypeScript
- MongoDB for efficient data management
- Rate-limited API calls to Human Protein Atlas
- Automatic plot generation
- Comprehensive error handling

## Example Use Cases

1. **Receptor Analysis**:
   ```
   Input: AGTR2 (Angiotensin II Receptor Type 2)
   Output: 
   - Expression profile of AGTR2
   - Ranked list of ligands by correlation
   - Visualization of expression patterns
   ```

2. **Ligand Analysis**:
   ```
   Input: AGT (Angiotensinogen)
   Output:
   - Expression profile of AGT
   - Ranked list of receptors by correlation
   - Visualization of expression patterns
   ```

## Development Setup
```bash
# Install dependencies
npm install

# Set up environment variables
vim .env.local .env
# Edit .env with your MongoDB URI and other settings (MONGODB_URI)

# Run development server
npm run dev
```

## Environment Variables
```env
MONGODB_URI=your_mongodb_connection_string
```

This web application provides a powerful tool for researchers and scientists to explore receptor-ligand relationships through expression data, offering intuitive visualization and comprehensive analysis features with efficient data management.

## MongoDB Setup

Before you begin, make sure you have the following ready:

- **MongoDB Atlas URI**: Setup your account if you don't already have one ([Create Account](https://www.mongodb.com/docs/guides/atlas/account/))
    
## Steps to Deploy 
Follow the below-mentioned steps to deploy the app on Vercel.

#### Step 1: Click below to navigate to the deployment page
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmongodb-partners%2FMongoDB-RAG-Vercel&env=OPENAI_API_KEY&demo-title=RAG%20with%20MongoDB%20Atlas%20and%20OpenAI&demo-url=https%3A%2F%2Fmonogodb-rag.vercel.app%2F&integration-ids=oac_jnzmjqM10gllKmSrG0SGrHOH)

#### Step 2: Add Environment Variables

Populate the values of the ENV variables mentioned below

````
MONGODB_URI = "<YOUR_MONGODB_URI>"                # Connection URI to MongoDB Instance (This should be automatically created after MongoDB Atlas integration)
````

#### Step 3: Deploy
Once you have updated the above values, go ahead and click deploy to deploy the app. Wait for the app to be deployed and start serving traffic.

