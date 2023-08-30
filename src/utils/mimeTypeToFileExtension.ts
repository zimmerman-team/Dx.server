
interface MimeToExtensionMap {
  [key: string]: string;
}

const mimeToExtension: MimeToExtensionMap = {
  'text/csv': '.csv',
  'application/json': '.json',
  'application/vnd.oasis.opendocument.presentation': '.odp',
  'application/vnd.oasis.opendocument.spreadsheet': '.ods',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/vnd.oasis.opendocument.formula': '.odf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel.sheet.macroEnabled.12': '.xlsm',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12': '.xlsb',
  'application/xml': '.xml',
};  

export function mimeTypeToFileExtension(mimetype: string, originalName: string): string {
  let ext = mimeToExtension[mimetype] ?? '';
  if (ext === '') {
    const parts = originalName.split('.');
    if (parts.length > 1) ext = '.' + parts[parts.length - 1];
  }
  return ext;
}
