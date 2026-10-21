export class AttachmentResponseDto {
  id!: string;
  issueId!: string;
  filename!: string;
  fileType!: string;
  fileSize!: number;
  uploadDate!: Date;
}
