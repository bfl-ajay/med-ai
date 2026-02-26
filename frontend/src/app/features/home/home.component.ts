import { Component } from '@angular/core';
import { AuthService } from 'src/app/core/services/auth.service';
import { Router } from '@angular/router';
import { ViewChild, ElementRef } from '@angular/core';




@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  name: string = '';
  email: string = '';
  message: string = '';

  constructor(private router: Router, private authService: AuthService) { }
  submitContact() {
    const data = {
      name: this.name,
      email: this.email,
      message: this.message
    };

    this.authService.sendContactMessage(data).subscribe({
      next: () => {
        alert("Message sent successfully!");
        this.name = '';
        this.email = '';
        this.message = '';
      },
      error: () => {
        alert("Failed to send message.");
      }
    });
  }
  @ViewChild('carousel') carousel!: ElementRef;
  activeIndex = 0;
  totalSlides = 4;

  scrollLeft() {
    if (this.activeIndex > 0) {
      this.activeIndex--;
      this.scrollToIndex();
    }
  }

  scrollRight() {
    if (this.activeIndex < this.totalSlides - 1) {
      this.activeIndex++;
      this.scrollToIndex();
    }
  }

  goToSlide(index: number) {
    this.activeIndex = index;
    this.scrollToIndex();
  }

  private scrollToIndex() {
    const slideWidth = this.carousel.nativeElement.offsetWidth;
    this.carousel.nativeElement.scrollTo({
      left: slideWidth * this.activeIndex,
      behavior: 'smooth'
    });
  }
}
