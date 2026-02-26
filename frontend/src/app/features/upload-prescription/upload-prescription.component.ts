import { Component } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-upload-prescription',
  templateUrl: './upload-prescription.component.html',
  styleUrls: ['./upload-prescription.component.css']
})
export class UploadPrescriptionComponent {

  doctorName: string = '';
  prescriptionText: string = '';
  manualDoctorName: string = '';
  manualPrescriptionText: string = '';
  selectedFile: File | null = null;
  prescriptions: any[] = [];
  analysisMap: { [key: number]: any } = {};
  loadingId: number | null = null;

  analyzePrescription(id: number) {

    // Toggle if already open
    if (this.analysisMap[id]) {
      delete this.analysisMap[id];
      return;
    }

    this.loadingId = id;

    this.authService.analyzePrescription(id).subscribe({
      next: (res: any) => {
        console.log("Analysis Response:", res);

        this.analysisMap[id] = res;  // store result per prescription
        this.loadingId = null;
      },
      error: (err) => {
        console.error(err);
        this.loadingId = null;
      }
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
  constructor(private authService: AuthService) { }

  ngOnInit() {
    this.loadPrescriptions();
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  submitFilePrescription() {
    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('prescription', this.selectedFile);
    formData.append('doctorName', this.doctorName);
    formData.append('notes', this.prescriptionText);

    this.authService.uploadPrescription(formData).subscribe(() => {
      this.selectedFile = null;
      this.doctorName = '';
      this.prescriptionText = '';
      this.loadPrescriptions();
    });
  }

  loadPrescriptions() {
    this.authService.getPrescriptions().subscribe((data: any) => {
      this.prescriptions = data;
    });
  }
  saveManualPrescription() {
    if (!this.manualPrescriptionText) return;

    const data = {
      doctorName: this.manualDoctorName,
      manualText: this.manualPrescriptionText
    };

    this.authService.saveManualPrescription(data).subscribe(() => {
      this.manualDoctorName = '';
      this.manualPrescriptionText = '';
      this.loadPrescriptions();
    });
  }
  deletePrescription(id: number) {
    if (!confirm('Are you sure you want to delete this prescription?')) {
      return;
    }

    this.authService.deletePrescription(id).subscribe({
      next: () => {
        this.prescriptions = this.prescriptions.filter(p => p.id !== id);
      },
      error: (err) => {
        console.error('Delete failed:', err);
      }
    });
  }
  submit() {
    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('prescription', this.selectedFile);
    formData.append('doctorName', this.doctorName);
    formData.append('notes', this.prescriptionText);

    this.authService.uploadPrescription(formData).subscribe(() => {
      this.selectedFile = null;
      this.doctorName = '';
      this.prescriptionText = '';
      this.loadPrescriptions();
    });
  }
}