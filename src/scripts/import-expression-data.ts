import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

interface ExpressionRecord {
  gene: string;
  gene_name: string;
  tissue: string;
  cluster: string;
  cell_type: string;
  read_count: number;
  nTPM: number;
  // Computed fields for easier querying
  cell_type_full: string; // cell_type + "_" + cluster
  tissue_cell_combo: string; // tissue + "_" + cell_type + "_" + cluster
}

async function importExpressionData() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();

    const db = client.db('coexpression_db');
    const collection = db.collection<ExpressionRecord>('expression_data');

    // Clear existing data
    console.log('Clearing existing expression data...');
    await collection.deleteMany({});

    const tsvPath = path.join(process.cwd(), 'data', 'rna_single_cell_type_tissue.tsv');

    if (!fs.existsSync(tsvPath)) {
      throw new Error(`TSV file not found at: ${tsvPath}`);
    }

    console.log('Creating read stream for TSV file...');
    const fileStream = fs.createReadStream(tsvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineCount = 0;
    let batchSize = 500; // Reduced batch size to avoid 16MB limit
    let batch: ExpressionRecord[] = [];
    let isFirstLine = true;
    let totalInserted = 0;

    console.log('Processing TSV file...');

    for await (const line of rl) {
      lineCount++;

      if (lineCount % 100000 === 0) {
        console.log(`Processed ${lineCount} lines...`);
      }

      // Skip header line
      if (isFirstLine) {
        isFirstLine = false;
        console.log('Header:', line);
        continue;
      }

      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const values = trimmedLine.split('\t');

      if (values.length < 7) {
        console.warn(`Skipping invalid line ${lineCount}: ${line}`);
        continue;
      }

      const record: ExpressionRecord = {
        gene: values[0],
        gene_name: values[1],
        tissue: values[2],
        cluster: values[3],
        cell_type: values[4],
        read_count: parseInt(values[5]) || 0,
        nTPM: parseFloat(values[6]) || 0,
        cell_type_full: `${values[4]}_${values[3]}`,
        tissue_cell_combo: `${values[2]}_${values[4]}_${values[3]}`
      };

      batch.push(record);

      // Insert batch when it reaches the limit
      if (batch.length >= batchSize) {
        try {
          await collection.insertMany(batch, { ordered: false });
          totalInserted += batch.length;
          console.log(`Inserted batch: ${totalInserted} total records inserted`);
          batch = [];
        } catch (error) {
          console.error('Error inserting batch:', error);
          // Try inserting records one by one to identify problematic records
          for (const record of batch) {
            try {
              await collection.insertOne(record);
              totalInserted += 1;
            } catch (singleError) {
              console.warn('Skipping problematic record:', record, singleError);
            }
          }
          batch = [];
        }
      }
    }

    // Insert remaining records
    if (batch.length > 0) {
      try {
        await collection.insertMany(batch, { ordered: false });
        totalInserted += batch.length;
        console.log(`Inserted final batch: ${totalInserted} total records inserted`);
      } catch (error) {
        console.error('Error inserting final batch:', error);
        // Try inserting remaining records one by one
        for (const record of batch) {
          try {
            await collection.insertOne(record);
            totalInserted += 1;
          } catch (singleError) {
            console.warn('Skipping problematic record:', record, singleError);
          }
        }
      }
    }

    console.log(`Finished processing ${lineCount - 1} lines.`);
    console.log(`Successfully imported ${totalInserted} records into MongoDB.`);

    // Create indexes for efficient querying
    console.log('Creating indexes...');

    await collection.createIndex({ gene: 1, tissue: 1 });
    await collection.createIndex({ gene_name: 1, tissue: 1 });
    await collection.createIndex({ gene: 1, cell_type_full: 1 });
    await collection.createIndex({ gene_name: 1, cell_type_full: 1 });
    await collection.createIndex({ gene: 1, tissue: 1, cell_type: 1 });
    await collection.createIndex({ gene_name: 1, tissue: 1, cell_type: 1 });
    await collection.createIndex({ tissue: 1 });
    await collection.createIndex({ cell_type: 1 });
    await collection.createIndex({ tissue_cell_combo: 1 });

    console.log('Indexes created successfully!');

    // Print some stats
    const totalCount = await collection.countDocuments();
    const uniqueGenes = await collection.distinct('gene');
    const uniqueTissues = await collection.distinct('tissue');
    const uniqueCellTypes = await collection.distinct('cell_type_full');

    console.log('\nImport Statistics:');
    console.log(`Total records in database: ${totalCount}`);
    console.log(`Records inserted this session: ${totalInserted}`);
    console.log(`Unique genes: ${uniqueGenes.length}`);
    console.log(`Unique tissues: ${uniqueTissues.length}`);
    console.log(`Unique cell types: ${uniqueCellTypes.length}`);

    console.log('\nSample data:');
    const sampleRecords = await collection.find({}).limit(3).toArray();
    console.log(sampleRecords);

  } catch (error) {
    console.error('Error importing expression data:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the import
if (require.main === module) {
  importExpressionData()
    .then(() => {
      console.log('Expression data import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

export { importExpressionData };