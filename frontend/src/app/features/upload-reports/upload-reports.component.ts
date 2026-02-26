import { Component } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';


@Component({
  selector: 'app-upload-reports',
  templateUrl: './upload-reports.component.html',
  styleUrls: ['./upload-reports.component.css']
})
export class UploadReportsComponent {

  selectedFile: File | null = null;
  reports: any[] = [];
  uploading = false;
  uploadSuccess = false;
  reportAnalysisMap: { [key: number]: any } = {};
  reportLoadingId: number | null = null;
  constructor(private authService: AuthService) { }

  ngOnInit() {
    this.loadReports();
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  upload() {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.uploadSuccess = false;

    const formData = new FormData();
    formData.append('report', this.selectedFile);

    this.authService.uploadReport(formData).subscribe({
      next: () => {
        this.uploading = false;
        this.uploadSuccess = true;
        this.selectedFile = null;
        this.loadReports();
      },
      error: () => {
        this.uploading = false;
        alert("Upload failed");
      }
    });
  }
  deleteReport(id: number) {
    this.authService.deleteReport(id).subscribe(() => {
      this.loadReports();
    });
  }

  loadReports() {
    this.authService.getReports().subscribe((data: any) => {
      this.reports = data;
    });
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files.length) {
      this.selectedFile = event.dataTransfer.files[0];
    }
  }
  analyzeReport(id: number) {

    // Toggle close if already open
    if (this.reportAnalysisMap[id]) {
      delete this.reportAnalysisMap[id];
      return;
    }

    this.reportLoadingId = id;

    this.authService.analyzeReport(id).subscribe({
      next: (res: any) => {
        this.reportAnalysisMap[id] = res;
        this.reportLoadingId = null;
      },
      error: (err) => {
        console.error(err);
        this.reportLoadingId = null;
      }
    });
  }

}

