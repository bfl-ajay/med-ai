import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-add-info',
  templateUrl: './add-info.component.html',
  styleUrls: ['./add-info.component.css']
})
export class AddInfoComponent implements OnInit {

  emergencyContact: string = '';
  allergies: string = '';
  notes: string = '';
  additionalInfos: any[] = [];
  pastRecords: any[] = [];

  constructor(private authService: AuthService) { }

  ngOnInit() {
    this.loadPastRecords();
  }

  loadPastRecords() {
    this.authService.getAdditionalInfo().subscribe((data: any) => {
      console.log("FROM API:", data);  // 👈 ADD THIS
      this.pastRecords = data;
    });
  }

  save() {
    const data = {
      emergencyContact: this.emergencyContact,
      allergies: this.allergies,
      notes: this.notes
    };

    this.authService.saveAdditionalInfo(data).subscribe(() => {
      this.emergencyContact = '';
      this.allergies = '';
      this.notes = '';

      // Reload after save
      this.loadPastRecords();
    });
  }
}