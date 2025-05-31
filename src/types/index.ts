export interface ExpressionProfile {
  gene_id: string;
  gene_name: string;
  uniprot_id: string;
  tissue_expression: ExpressionData[];
  cell_expression: ExpressionData[];
}

export interface ExpressionData {
  name: string;
  value: number;
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
}

export interface ExpressionStats {
  tissue: CoexpressionFeatures;
  cell: CoexpressionFeatures;
  combined: CoexpressionFeatures;
}

export interface SearchResult {
  pair: ReceptorLigandPair;
  features: ExpressionStats;
  expression: {
    receptor: ExpressionProfile;
    ligand: ExpressionProfile;
  };
} 