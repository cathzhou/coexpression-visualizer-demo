# Receptor-Ligand Co-expression Visualizer

## Overview
This web application allows users to explore and visualize expression profiles of receptors and their corresponding ligands (or vice versa) using data from the Human Protein Atlas. Users can input either a gene name or UniProt ID to discover co-expression patterns and visualize tissue and cell-type specific expression profiles.

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
cp .env.example .env
# Edit .env with your MongoDB URI and other settings

# Run development server
npm run dev
```

## Environment Variables
```env
MONGODB_URI=your_mongodb_connection_string
CACHE_DURATION=3600  # 1 hour in seconds
MAX_CACHE_SIZE=100   # Maximum number of cached profiles
```

This web application provides a powerful tool for researchers and scientists to explore receptor-ligand relationships through expression data, offering intuitive visualization and comprehensive analysis features with efficient data management.


# RAG Based Chat-bot using Langchain and MongoDB Atlas
This starter template implements a Retrieval-Augmented Generation (RAG) chatbot using LangChain and MongoDB Atlas. RAG combines AI language generation with knowledge retrieval for more informative responses. LangChain simplifies building the chatbot logic, while MongoDB Atlas' Vector database capability provides a powerful platform for storing and searching the knowledge base that fuels the chatbot's responses.

## Setup 
### Prerequisites

Before you begin, make sure you have the following ready:

- **MongoDB Atlas URI**: Setup your account if you don't already have one ([Create Account](https://www.mongodb.com/docs/guides/atlas/account/))
    
- **OpenAI API Key** (https://platform.openai.com/api-keys)



## Steps to Deploy 
Follow the below-mentioned steps to deploy the app on Vercel.

#### Step 1: Click below to navigate to the deployment page
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmongodb-partners%2FMongoDB-RAG-Vercel&env=OPENAI_API_KEY&demo-title=RAG%20with%20MongoDB%20Atlas%20and%20OpenAI&demo-url=https%3A%2F%2Fmonogodb-rag.vercel.app%2F&integration-ids=oac_jnzmjqM10gllKmSrG0SGrHOH)

#### Step 2: Add Environment Variables

Populate the values of the ENV variables mentioned below

````
OPENAI_API_KEY = "<YOUR_OPENAI_KEY>"              # API Key copied from the OpenAI portal
MONGODB_URI = "<YOUR_MONGODB_URI>"                # Connection URI to MongoDB Instance (This should be automatically created after MongoDB Atlas integration)
````

#### Step 3: Deploy
Once you have updated the above values, go ahead and click deploy to deploy the app. Wait for the app to be deployed and start serving traffic.


#### Step 4: Upload PDF files to create chunks
Head to the `Train` tab and upload a PDF document. 

If everything is deployed correctly, your document should start uploading to your cluster under the `chatter > training_data` collection.

Your data should now start appearing as below in the collection.

![image](https://github.com/utsavMongoDB/MongoDB-RAG-NextJS/assets/114057324/316af753-8f7b-492f-b51a-c23c109a3fac)



#### Step 5: Create Vector Index on Atlas
Now for the RAG (QnA) to work, you need to create a Vector Search Index on Atlas so the vector data can be fetched and served to LLMs.

Create a search index as below.

- Let’s head over to our MongoDB Atlas user interface to create our Vector Search Index. First, click on the “Search” tab and then on “Create Search Index.” You’ll be taken to this page (shown below). Please click on “JSON Editor.”
 ![image](https://github.com/utsavMongoDB/MongoDB-RAG-NextJS/assets/114057324/b41a09a8-9875-4e5d-9549-e62652389d33)

- Next input the values as shown in the below image and create the Vector.
    ```
    {
      "fields": [
        {
          "numDimensions": 1536,
          "path": "text_embedding",
          "similarity": "cosine",
          "type": "vector"
        }
      ]
    }
    ```
  ![image](https://github.com/utsavMongoDB/MongoDB-RAG-NextJS/assets/114057324/ea1c8fa9-d391-40e6-b838-7a49fdf6bbd7)

- You should start seeing a vector index getting created. You should get an email once index creation is completed.
  ![image](https://github.com/utsavMongoDB/MongoDB-RAG-NextJS/assets/114057324/c1842069-4080-4251-8269-08d9398e09aa)

- Once completed, head to the QnA section to start asking questions based on your trained data, and you should get the desired response.

  ![image](https://github.com/utsavMongoDB/MongoDB-RAG-NextJS/assets/114057324/c76c8c19-e18a-46b1-834a-9a6bda7fec99)



## Reference Architechture 

![image](https://github.com/mongodb-partners/MongoDB-RAG-Vercel/assets/114057324/3a4b863e-cea3-4d89-a6f5-24a4ee44cfd4)


This architecture depicts a Retrieval-Augmented Generation (RAG) chatbot system built with LangChain, OpenAI, and MongoDB Atlas Vector Search. Let's break down its key players:

- **PDF File**: This serves as the knowledge base, containing the information the chatbot draws from to answer questions. The RAG system extracts and processes this data to fuel the chatbot's responses.
- **Text Chunks**: These are meticulously crafted segments extracted from the PDF. By dividing the document into smaller, targeted pieces, the system can efficiently search and retrieve the most relevant information for specific user queries.
- **LangChain**: This acts as the central control unit, coordinating the flow of information between the chatbot and the other components. It preprocesses user queries, selects the most appropriate text chunks based on relevance, and feeds them to OpenAI for response generation.
- **Query Prompt**: This signifies the user's question or input that the chatbot needs to respond to.
- **Actor**: This component acts as the trigger, initiating the retrieval and generation process based on the user query. It instructs LangChain and OpenAI to work together to retrieve relevant information and formulate a response.
- **OpenAI Embeddings**: OpenAI, a powerful large language model (LLM), takes centre stage in response generation. By processing the retrieved text chunks (potentially converted into numerical representations or embeddings), OpenAI crafts a response that aligns with the user's query and leverages the retrieved knowledge.
- **MongoDB Atlas Vector Store**: This specialized database is optimized for storing and searching vector embeddings. It efficiently retrieves the most relevant text chunks from the knowledge base based on the query prompt's embedding. These retrieved knowledge nuggets are then fed to OpenAI to inform its response generation.


This RAG-based architecture seamlessly integrates retrieval and generation. It retrieves the most relevant knowledge from the database and utilizes OpenAI's language processing capabilities to deliver informative and insightful answers to user queries.


## Implementation 

The below components are used to build up the bot, which can retrieve the required information from the vector store, feed it to the chain and stream responses to the client.

#### LLM Model 

        const model = new ChatOpenAI({
            temperature: 0.8,
            streaming: true,
            callbacks: [handlers],
        });


#### Vector Store

        const retriever = vectorStore().asRetriever({ 
            "searchType": "mmr", 
            "searchKwargs": { "fetchK": 10, "lambda": 0.25 } 
        })

#### Chain

       const conversationChain = ConversationalRetrievalQAChain.fromLLM(model, retriever, {
            memory: new BufferMemory({
              memoryKey: "chat_history",
            }),
          })
        conversationChain.invoke({
            "question": question
        })
