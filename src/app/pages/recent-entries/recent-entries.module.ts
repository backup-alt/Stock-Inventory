import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { RecentEntriesPage } from './recent-entries.page';

const routes: Routes = [{ path: '', component: RecentEntriesPage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [RecentEntriesPage]
})
export class RecentEntriesPageModule {}
