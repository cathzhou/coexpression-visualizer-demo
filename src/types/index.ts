export interface ExpressionProfile {
  uniprot_id: string;
  gene_name: string;
  tissue_data: { [key: string]: number };
  cell_type_data: { [key: string]: number };
  timestamp: Date;
}

export interface ReceptorLigandPair {
  p1_id: string;    // Receptor UniProt ID
  p1_name: string;  // Receptor gene name
  p2_id: string;    // Ligand UniProt ID
  p2_name: string;  // Ligand gene name
}

export interface CoexpressionFeatures {
  pearson_corr: number;
  cosine_sim: number;
  jaccard_index: number;
  l2_norm_diff: number;
  overlap_count: number;
  shared_top10_count: number;
  common_types: number;
}

export interface SearchResult {
  pair: ReceptorLigandPair;
  features: CoexpressionFeatures;
  plots: {
    receptor: string;  // URL to plot image
    ligand: string;    // URL to plot image
  };
} 