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

  constructor(private authService: AuthService) { }

  ngOnInit() {
    this.loadInfo();
  }

  save() {
    const data = {
      emergencyContact: this.emergencyContact,
      allergies: this.allergies,
      notes: this.notes
    };

    this.authService.saveAdditionalInfo(data).subscribe(() => {
      alert("Information saved successfully");

      this.loadInfo();
    });
  }

  loadInfo() {
    this.authService.getAdditionalInfo().subscribe((res: any) => {
      this.additionalInfos = res;
    });
  }
}