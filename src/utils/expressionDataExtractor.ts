import type { ExpressionProfile, CoexpressionFeatures } from '@/types';

export class ExpressionDataExtractor {
  private baseUrl = 'https://www.proteinatlas.org';
  private cachePath = '/data/expression_cache';
  private plotsPath = '/data/expression_cache/plots';

  // Define the actual column names
  private tissueColumns = [
    't_RNA_adipose_tissue', 't_RNA_adrenal_gland', 't_RNA_amygdala', 't_RNA_appendix',
    't_RNA_basal_ganglia', 't_RNA_bone_marrow', 't_RNA_breast', 't_RNA_cerebellum',
    't_RNA_cerebral_cortex', 't_RNA_cervix', 't_RNA_choroid_plexus', 't_RNA_colon',
    't_RNA_duodenum', 't_RNA_endometrium_1', 't_RNA_epididymis', 't_RNA_esophagus',
    't_RNA_fallopian_tube', 't_RNA_gallbladder', 't_RNA_heart_muscle',
    't_RNA_hippocampal_formation', 't_RNA_hypothalamus', 't_RNA_kidney', 't_RNA_liver',
    't_RNA_lung', 't_RNA_lymph_node', 't_RNA_midbrain', 't_RNA_ovary', 't_RNA_pancreas',
    't_RNA_parathyroid_gland', 't_RNA_pituitary_gland', 't_RNA_placenta', 't_RNA_prostate',
    't_RNA_rectum', 't_RNA_retina', 't_RNA_salivary_gland', 't_RNA_seminal_vesicle',
    't_RNA_skeletal_muscle', 't_RNA_skin_1', 't_RNA_small_intestine', 't_RNA_smooth_muscle',
    't_RNA_spinal_cord', 't_RNA_spleen', 't_RNA_stomach_1', 't_RNA_testis', 't_RNA_thymus',
    't_RNA_thyroid_gland', 't_RNA_tongue', 't_RNA_tonsil', 't_RNA_urinary_bladder',
    't_RNA_vagina'
  ];

  private cellTypeColumns = [
    'sc_RNA_Adipocytes', 'sc_RNA_Alveolar_cells_type_1', 'sc_RNA_Alveolar_cells_type_2',
    'sc_RNA_Astrocytes', 'sc_RNA_B-cells', 'sc_RNA_Basal_keratinocytes',
    'sc_RNA_Basal_prostatic_cells', 'sc_RNA_Basal_respiratory_cells',
    'sc_RNA_Basal_squamous_epithelial_cells', 'sc_RNA_Bipolar_cells',
    'sc_RNA_Breast_glandular_cells', 'sc_RNA_Breast_myoepithelial_cells',
    'sc_RNA_Cardiomyocytes', 'sc_RNA_Cholangiocytes', 'sc_RNA_Ciliated_cells',
    'sc_RNA_Club_cells', 'sc_RNA_Collecting_duct_cells', 'sc_RNA_Cone_photoreceptor_cells',
    'sc_RNA_Cytotrophoblasts', 'sc_RNA_dendritic_cells', 'sc_RNA_Distal_enterocytes',
    'sc_RNA_Distal_tubular_cells', 'sc_RNA_Ductal_cells', 'sc_RNA_Early_spermatids',
    'sc_RNA_Endometrial_stromal_cells', 'sc_RNA_Endothelial_cells',
    'sc_RNA_Enteroendocrine_cells', 'sc_RNA_Erythroid_cells', 'sc_RNA_Excitatory_neurons',
    'sc_RNA_Exocrine_glandular_cells', 'sc_RNA_Extravillous_trophoblasts',
    'sc_RNA_Fibroblasts', 'sc_RNA_Gastric_mucus-secreting_cells',
    'sc_RNA_Glandular_and_luminal_cells', 'sc_RNA_granulocytes', 'sc_RNA_Granulosa_cells',
    'sc_RNA_Hepatocytes', 'sc_RNA_Hofbauer_cells', 'sc_RNA_Horizontal_cells',
    'sc_RNA_Inhibitory_neurons', 'sc_RNA_Intestinal_goblet_cells', 'sc_RNA_Ionocytes',
    'sc_RNA_Kupffer_cells', 'sc_RNA_Langerhans_cells', 'sc_RNA_Late_spermatids',
    'sc_RNA_Leydig_cells', 'sc_RNA_Lymphatic_endothelial_cells', 'sc_RNA_Macrophages',
    'sc_RNA_Melanocytes', 'sc_RNA_Mesothelial_cells', 'sc_RNA_Microglial_cells',
    'sc_RNA_monocytes', 'sc_RNA_Mucus_glandular_cells', 'sc_RNA_Muller_glia_cells',
    'sc_RNA_NK-cells', 'sc_RNA_Oligodendrocyte_precursor_cells', 'sc_RNA_Oligodendrocytes',
    'sc_RNA_Oocytes', 'sc_RNA_Ovarian_stromal_cells', 'sc_RNA_Pancreatic_endocrine_cells',
    'sc_RNA_Paneth_cells', 'sc_RNA_Peritubular_cells', 'sc_RNA_Plasma_cells',
    'sc_RNA_Prostatic_glandular_cells', 'sc_RNA_Proximal_enterocytes',
    'sc_RNA_Proximal_tubular_cells', 'sc_RNA_Rod_photoreceptor_cells',
    'sc_RNA_Salivary_duct_cells', 'sc_RNA_Schwann_cells', 'sc_RNA_Secretory_cells',
    'sc_RNA_Serous_glandular_cells', 'sc_RNA_Sertoli_cells', 'sc_RNA_Skeletal_myocytes',
    'sc_RNA_Smooth_muscle_cells', 'sc_RNA_Spermatocytes', 'sc_RNA_Spermatogonia',
    'sc_RNA_Squamous_epithelial_cells', 'sc_RNA_Suprabasal_keratinocytes',
    'sc_RNA_Syncytiotrophoblasts', 'sc_RNA_T-cells', 'sc_RNA_Undifferentiated_cells'
  ];

  // Helper function to convert internal name to API name
  private getApiTissueName(internalName: string): string {
    const tissueName = internalName.replace('t_RNA_', '').replace(/_/g, ' ');
    return `Tissue RNA - ${tissueName} [nTPM]`;
  }

  private getApiCellTypeName(internalName: string): string {
    const cellTypeName = internalName.replace('sc_RNA_', '').replace(/_/g, ' ');
    return `Single Cell Type RNA - ${cellTypeName} [nTPM]`;
  }

  async get_expression_matrix(uniprotId: string): Promise<[number[], number[]] | null> {
    try {
      // Build the search URL with parameters
      const params = new URLSearchParams({
        search: uniprotId,
        format: 'json',
        columns: ['g', 'gs', 'up', ...this.tissueColumns, ...this.cellTypeColumns].join(','),
        compress: 'no'
      });

      const response = await fetch(`${this.baseUrl}/api/search_download.php?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data[0]) {
        console.log(`No data found for UniProt ID: ${uniprotId}`);
        return null;
      }

      console.log(data[0]['g']);

      // Extract tissue and cell type data
      const entry = data[0];
      const tissueData: number[] = [];
      const cellTypeData: number[] = [];

      // Process tissue data
      for (const column of this.tissueColumns) {
        const apiColumnName = `Tissue RNA - ${column.replace('t_RNA_', '').replace(/_/g, ' ')} [nTPM]`;
        const value = parseFloat(entry[apiColumnName] || '0');
        tissueData.push(isNaN(value) ? 0 : value);
      }

      // Process cell type data
      for (const column of this.cellTypeColumns) {
        const apiColumnName = `Single Cell Type RNA - ${column.replace('sc_RNA_', '').replace(/_/g, ' ')} [nTPM]`;
        const value = parseFloat(entry[apiColumnName] || '0');
        cellTypeData.push(isNaN(value) ? 0 : value);
      }
      
      // Log first 5 tissue values with their names
      console.log('First 5 tissue expression values:');
      this.tissueColumns.slice(0, 5).forEach((column: string, i: number) => {
        const apiColumnName = `Tissue RNA - ${column.replace('t_RNA_', '').replace(/_/g, ' ')} [nTPM]`;
        console.log(`${apiColumnName}: ${tissueData[i]}`);
      });

      // Log first 5 cell type values with their names
      console.log('\nFirst 5 cell type expression values:');
      this.cellTypeColumns.slice(0, 5).forEach((column: string, i: number) => {
        const apiColumnName = `Single Cell Type RNA - ${column.replace('sc_RNA_', '').replace(/_/g, ' ')} [nTPM]`;
        console.log(`${apiColumnName}: ${cellTypeData[i]}`);
      });

      return [tissueData, cellTypeData];

    } catch (error) {
      console.error(`Error fetching data for ${uniprotId}:`, error);
      return null;
    }
  }

  compute_coexpression_features(
    receptorExpr: [number[], number[]],
    ligandExpr: [number[], number[]]
  ): CoexpressionFeatures | null {
    try {
      const [receptorTissue, receptorCell] = receptorExpr;
      const [ligandTissue, ligandCell] = ligandExpr;

      // Compute tissue features
      const tissueFeatures = this.computeFeatures(receptorTissue, ligandTissue);
      const cellFeatures = this.computeFeatures(receptorCell, ligandCell);

      if (!tissueFeatures || !cellFeatures) return null;

      // Combine and average the features
      return {
        pearson_corr: (tissueFeatures.pearson_corr + cellFeatures.pearson_corr) / 2,
        cosine_sim: (tissueFeatures.cosine_sim + cellFeatures.cosine_sim) / 2,
        jaccard_index: (tissueFeatures.jaccard_index + cellFeatures.jaccard_index) / 2,
        l2_norm_diff: (tissueFeatures.l2_norm_diff + cellFeatures.l2_norm_diff) / 2,
        overlap_count: Math.round((tissueFeatures.overlap_count + cellFeatures.overlap_count) / 2),
        shared_top10_count: Math.round((tissueFeatures.shared_top10_count + cellFeatures.shared_top10_count) / 2),
        common_types: tissueFeatures.common_types + cellFeatures.common_types
      };

    } catch (error) {
      console.error('Error computing coexpression features:', error);
      return null;
    }
  }

  private computeFeatures(vec1: number[], vec2: number[]): CoexpressionFeatures | null {
    if (!vec1.length || !vec2.length || vec1.length !== vec2.length) return null;

    // Calculate mean for vectors
    const mean1 = vec1.reduce((a, b) => a + b, 0) / vec1.length;
    const mean2 = vec2.reduce((a, b) => a + b, 0) / vec2.length;

    // Calculate Pearson correlation
    let num = 0;
    let den1 = 0;
    let den2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      const diff1 = vec1[i] - mean1;
      const diff2 = vec2[i] - mean2;
      num += diff1 * diff2;
      den1 += diff1 * diff1;
      den2 += diff2 * diff2;
    }

    const pearson_corr = num / (Math.sqrt(den1) * Math.sqrt(den2));

    // Calculate cosine similarity
    const dotProduct = vec1.reduce((sum, v1, i) => sum + v1 * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
    const cosine_sim = dotProduct / (norm1 * norm2);

    // Calculate binary metrics using median as threshold
    const median1 = [...vec1].sort((a, b) => a - b)[Math.floor(vec1.length / 2)];
    const median2 = [...vec2].sort((a, b) => a - b)[Math.floor(vec2.length / 2)];
    
    const vec1_binary = vec1.map(v => v > median1 ? 1 : 0);
    const vec2_binary = vec2.map(v => v > median2 ? 1 : 0);

    let overlap_count = 0;
    let union_count = 0;
    
    for (let i = 0; i < vec1_binary.length; i++) {
      if (vec1_binary[i] && vec2_binary[i]) overlap_count++;
      if (vec1_binary[i] || vec2_binary[i]) union_count++;
    }

    // Get indices of top 10 values
    const top10_indices1 = vec1
      .map((v, i) => ({ value: v, index: i }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(item => item.index);
    
    const top10_indices2 = vec2
      .map((v, i) => ({ value: v, index: i }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map(item => item.index);

    const shared_top10_count = top10_indices1.filter(i => top10_indices2.includes(i)).length;

    return {
      pearson_corr,
      cosine_sim,
      jaccard_index: union_count > 0 ? overlap_count / union_count : 0,
      l2_norm_diff: Math.sqrt(vec1.reduce((sum, v1, i) => sum + Math.pow(v1 - vec2[i], 2), 0)),
      overlap_count,
      shared_top10_count,
      common_types: vec1.length
    };
  }
} 