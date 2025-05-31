import { ExpressionProfile, ExpressionData, CoexpressionFeatures, ExpressionStats } from '@/types';

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

  private computeFeatures(data1: number[], data2: number[]): CoexpressionFeatures {
    // Compute Pearson correlation
    const mean1 = data1.reduce((a, b) => a + b, 0) / data1.length;
    const mean2 = data2.reduce((a, b) => a + b, 0) / data2.length;
    
    const numerator = data1.reduce((sum, x, i) => sum + (x - mean1) * (data2[i] - mean2), 0);
    const denom1 = Math.sqrt(data1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0));
    const denom2 = Math.sqrt(data2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0));
    
    const pearson = numerator / (denom1 * denom2);

    // Compute cosine similarity
    const dotProduct = data1.reduce((sum, x, i) => sum + x * data2[i], 0);
    const norm1 = Math.sqrt(data1.reduce((sum, x) => sum + x * x, 0));
    const norm2 = Math.sqrt(data2.reduce((sum, x) => sum + x * x, 0));
    const cosine = dotProduct / (norm1 * norm2);

    // Compute Jaccard index (using threshold of mean value)
    const threshold1 = mean1;
    const threshold2 = mean2;
    let intersection = 0;
    let union = 0;
    
    for (let i = 0; i < data1.length; i++) {
      const above1 = data1[i] > threshold1;
      const above2 = data2[i] > threshold2;
      if (above1 && above2) intersection++;
      if (above1 || above2) union++;
    }
    
    const jaccard = union === 0 ? 0 : intersection / union;

    return {
      pearson_corr: pearson,
      cosine_sim: cosine,
      jaccard_index: jaccard
    };
  }

  async get_expression_matrix(gene_id: string): Promise<ExpressionProfile | null> {
    try {
      // Build the search URL with parameters
      const params = new URLSearchParams({
        search:gene_id,
        format: 'json',
        columns: ['g', 'gs', 'up', ...this.tissueColumns, ...this.cellTypeColumns].join(','),
        compress: 'no'
      });

      const response = await fetch(`${this.baseUrl}/api/search_download.php?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data[0]) {
        console.log(`No data found for UniProt ID: ${gene_id}`);
        return null;
      }
      
      const entry = data[0];
      
      // Process tissue RNA data
      const tissue_expression: ExpressionData[] = [];
      Object.entries(entry).forEach(([key, value]) => {
        if (key.startsWith('Tissue RNA - ') && key.endsWith('[nTPM]')) {
          const tissue = key.replace('Tissue RNA - ', '').replace(' [nTPM]', '');
          tissue_expression.push({
            name: tissue,
            value: parseFloat(value as string) || 0
          });
        }
      });

      // Process single cell RNA data
      const cell_expression: ExpressionData[] = [];
      Object.entries(entry).forEach(([key, value]) => {
        if (key.startsWith('Single Cell Type RNA - ') && key.endsWith('[nTPM]')) {
          const cell = key.replace('Single Cell Type RNA - ', '').replace(' [nTPM]', '');
          cell_expression.push({
            name: cell,
            value: parseFloat(value as string) || 0
          });
        }
      });
      //console.log(entry)
      console.log(entry.Gene)
      console.log(entry.Gene)

      return {
        gene_id,
        gene_name: entry.Gene,
        uniprot_id: entry.Uniprot,
        tissue_expression,
        cell_expression
      };
    } catch (error) {
      console.error(`Error fetching expression data for ${gene_id}:`, error);
      return null;
    }
  }

  compute_coexpression_features(
    profile1: ExpressionProfile,
    profile2: ExpressionProfile
  ): ExpressionStats {
    // Extract values for tissue expression
    const tissue1 = profile1.tissue_expression.map(t => t.value);
    const tissue2 = profile2.tissue_expression.map(t => t.value);
    
    // Extract values for cell expression
    const cell1 = profile1.cell_expression.map(c => c.value);
    const cell2 = profile2.cell_expression.map(c => c.value);
    
    // Combine all values for overall correlation
    const all1 = [...tissue1, ...cell1];
    const all2 = [...tissue2, ...cell2];

    return {
      tissue: this.computeFeatures(tissue1, tissue2),
      cell: this.computeFeatures(cell1, cell2),
      combined: this.computeFeatures(all1, all2)
    };
  }
} 