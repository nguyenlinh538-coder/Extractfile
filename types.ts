
export type DocType = 'PHIEU_THAY_DOI' | 'BCSPKPH' | 'DE_XUAT_CAI_TIEN' | 'KHAC';

export interface GMPChangeData {
  product_name: string;
  batch_number: string;
  change_content: string;
}

export interface BCSPKPHData {
  nonconformity_code: string;
  product_name: string;
  batch_number: string;
  process_step: string;
  apply_date: string;
  nonconformity_content: string;
  root_cause: string;
  corrective_action: string;
}

export interface ImprovementProposalData {
  proposal_content: string;
}

export interface ProcessingResult {
  doc_type: DocType;
  data: (GMPChangeData | BCSPKPHData | ImprovementProposalData)[];
}

export interface FileState {
  file: File;
  base64: string;
  type: string;
  preview: string;
}
