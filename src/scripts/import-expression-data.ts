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
  g: string;         // gene (shortened field name)
  gn: string;        // gene_name
  t: string;         // tissue
  c: string;         // cluster
  ct: string;        // cell_type
  n: number;         // nTPM
}

async function importExpressionData() {
  const client = new MongoClient(MONGODB_URI!);

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
    let batchSize = 1000; // Increased batch size since records are smaller now
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

      if (values.length < 6) {
        console.warn(`Skipping invalid line ${lineCount}: ${line}`);
        continue;
      }

      const record: ExpressionRecord = {
        g: values[0],      // gene
        gn: values[1],     // gene_name
        t: values[2],      // tissue
        c: values[3],      // cluster
        ct: values[4],     // cell_type
        n: parseFloat(values[5]) || 0  // nTPM
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

    // Create compound indexes for optimal query performance
    await collection.createIndex({ gn: 1, g: 1 });       // Combined gene lookup
    await collection.createIndex({ gn: 1, t: 1 });       // gene_name, tissue
    await collection.createIndex({ g: 1, t: 1 });        // gene, tissue
    await collection.createIndex({ gn: 1, ct: 1 });      // gene_name, cell_type
    await collection.createIndex({ g: 1, ct: 1 });       // gene, cell_type
    await collection.createIndex({ t: 1, ct: 1 });       // tissue, cell_type
    await collection.createIndex({ ct: 1 });             // cell_type
    await collection.createIndex({ t: 1 });              // tissue

    console.log('Indexes created successfully!');

    // Print some stats
    const totalCount = await collection.countDocuments();
    const uniqueGenes = await collection.distinct('g');
    const uniqueTissues = await collection.distinct('t');
    const uniqueCellTypes = await collection.distinct('ct');

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