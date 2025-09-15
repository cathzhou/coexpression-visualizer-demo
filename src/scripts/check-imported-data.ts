import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

async function checkImportedData() {
  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();

    const db = client.db('coexpression_db');
    const collection = db.collection('expression_data');

    // Get basic statistics
    const totalCount = await collection.countDocuments();
    const uniqueGenes = await collection.distinct('gene');
    const uniqueTissues = await collection.distinct('tissue');
    const uniqueCellTypes = await collection.distinct('cell_type');

    console.log('\n=== Current Database Statistics ===');
    console.log(`Total records: ${totalCount.toLocaleString()}`);
    console.log(`Unique genes: ${uniqueGenes.length.toLocaleString()}`);
    console.log(`Unique tissues: ${uniqueTissues.length}`);
    console.log(`Unique cell types: ${uniqueCellTypes.length}`);

    console.log('\n=== Available Tissues ===');
    uniqueTissues.sort().forEach((tissue: string) => console.log(`- ${tissue}`));

    console.log('\n=== Available Cell Types (first 20) ===');
    uniqueCellTypes.sort().slice(0, 20).forEach((cellType: string) => console.log(`- ${cellType}`));
    if (uniqueCellTypes.length > 20) {
      console.log(`... and ${uniqueCellTypes.length - 20} more cell types`);
    }

    // Check for some common genes
    console.log('\n=== Sample Gene Availability ===');
    const testGenes = ['TNF', 'TNFRSF1A', 'IL6', 'ACTB', 'GAPDH'];

    for (const gene of testGenes) {
      const geneCount = await collection.countDocuments({
        $or: [
          { gene_name: gene },
          { gene: gene }
        ]
      });
      console.log(`${gene}: ${geneCount} records`);
    }

    console.log('\n=== Sample Data ===');
    const sampleRecords = await collection.find({}).limit(3).toArray();
    sampleRecords.forEach((record: any) => {
      console.log(`Gene: ${record.gene_name} (${record.gene}) | Tissue: ${record.tissue} | Cell: ${record.cell_type} | Expression: ${record.nTPM}`);
    });

  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await client.close();
  }
}

// Run the check
if (require.main === module) {
  checkImportedData()
    .then(() => {
      console.log('\nData check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Check failed:', error);
      process.exit(1);
    });
}

export { checkImportedData };