
export type FileContents = {
  url: string
  mimeType: string
  contents: string
}

type FileProperties = {
  directory?: 'home' | 'appData' | 'userData' | 'sessionData' | 'temp' | 'documents' | 'downloads';
  prompt?: boolean;
  subdir?: string | false;
  filename?: string;
}

export type FileSaveParams = {
  contents: string
  url?: string
  properties?: FileProperties;
}

export type FileDownloadParams = {
  url: string
  properties?: FileProperties;
}

export type FilePickParams = {
  packages?: boolean;
  location?: boolean;
  multiselection?: boolean;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
}
