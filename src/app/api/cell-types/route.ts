import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('coexpression_db');
    const collection = db.collection('expression_data');

    // Get unique cell types
    const cellTypes = await collection.distinct('ct');

    // Sort alphabetically
    cellTypes.sort();

    console.log('Retrieved cell types:', cellTypes.length);

    return NextResponse.json({
      cellTypes,
      count: cellTypes.length
    });

  } catch (error) {
    console.error('Error fetching cell types:', error);
    return NextResponse.json({
      error: 'Failed to fetch cell types',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}