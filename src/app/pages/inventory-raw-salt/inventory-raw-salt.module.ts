import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { InventoryRawSaltPage } from './inventory-raw-salt.page';

const routes: Routes = [{ path: '', component: InventoryRawSaltPage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [InventoryRawSaltPage]
})
export class InventoryRawSaltPageModule {}
