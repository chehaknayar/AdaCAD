import { Component, OnInit, Inject, EventEmitter, Output, ChangeDetectorRef } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Shuttle } from '../../../core/model/shuttle';
import { DesignmodesService } from '../../provider/designmodes.service';
import { MaterialMap, MaterialsService } from '../../provider/materials.service';
import { TreeService } from '../../../core/provider/tree.service';
import utilInstance from '../../model/util';
import { Draft,DraftNode } from '../../model/datatypes';
import { add } from 'lodash';
import { addN } from '@tensorflow/tfjs';


@Component({
  selector: 'app-material-modal',
  templateUrl: './material.modal.html',
  styleUrls: ['./material.modal.scss']
})



export class MaterialModal{

  
  @Output() onChange: any = new EventEmitter();
  replacements: Array<number> = [];
  types: any;
  newshuttle: Shuttle = new Shuttle();
  addmaterial: boolean = false;
  colorKeyword: string = ''; // Add this property to store the color keyword
  shuttle: Shuttle; // Add this property to store the current shuttle

  constructor(
    private dm: DesignmodesService,
    public ms: MaterialsService,
    private tree: TreeService,
    private dialogRef: MatDialogRef<MaterialModal>,
    private changeDetectorRef: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: {draft:Draft}) {

    ms.getShuttles().forEach((el, ndx) => {
      this.replacements.push((ndx+1 % this.ms.getShuttles().length));
    });
    this.types = dm.material_types;
}

hexToRgb(hex: string): number[] | null {
  // Remove any leading '#' character, if present
  hex = hex.replace('#', '');

  // Check if the hexadecimal color value is valid
  const hexRegex = /^[0-9A-Fa-f]{6}$/;
  if (!hexRegex.test(hex)) {
    // Invalid hexadecimal color, return null
    return null;
  }

  // Extract the RGB components from the hexadecimal color
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Return the RGB components as an array
  return [r, g, b];
}

async updateColorPicker(colorKeyword: string) {
  console.log("shuttles",this.ms.getShuttles())
  
  const colorMap = {
    calm: '#3333CC',   // Blue
    clouds: '#CCCCCC', // Light Grey
    angry: '#FF0000',  // Red
    // Add more color keywords and corresponding color values here
    //add colors above in rgb format
    //blue in rgb format


  };

  // Get the color value corresponding to the entered keyword
  const keyword = colorKeyword.toLowerCase();
  console.log("keyword",keyword)
  const selectedColor = colorMap[keyword] || '#000000'; // Default to black if keyword not found
  
  //as soon as a keyword is found, colormind finds th epalette and creates materials for that palette colors instantly Part 1/////////////
  // if (colorMap[keyword]) {
  //   const newColors = await this.getNewColorsFromAPI(); // Assuming this function returns a promise with the new colors

  //   for (const color of newColors) {
  //     this.newshuttle.color = color;
  //     this.addNewShuttle();
  //   }
  // }
  //ends here/////////////

  // //colormind api inserts new shuttle with the color given for a keyword, when the keyword is found //////////////////
  if(colorMap[keyword]){
    var url = "http://colormind.io/api/";
    var data = {
      model : "default",
      input : [this.hexToRgb(this.newshuttle.color),"N","N","N"]
    }
    var http = new XMLHttpRequest();
    var newColors = [];
    http.onreadystatechange = function() {
      if(http.readyState == 4 && http.status == 200) {
        var palette = JSON.parse(http.responseText).result;
        console.log('response:',palette);
        for (var i = 0; i < palette.length; i++) {
          var c = palette[i];
          newColors.push("rgb("+c[0]+","+c[1]+","+c[2]+")");
        }
      }
  }
  
  
  // Set the current shuttle's color property to the selected color
  console.log("neww shuttle",this.newshuttle)
  if (this.newshuttle) {
      this.newshuttle.color = selectedColor;
  }
  console.log("new shuttle",this.newshuttle.color,this.hexToRgb(this.newshuttle.color))
 //to create a new shuttle of that color
  this.addNewShuttle();
  http.open("POST", url, true);
  http.send(JSON.stringify(data));
  }
  // // ends here
  

  
  
  //
  // Update the color picker's background to reflect the new color
  this.colorKeyword = colorKeyword; // Update the colorKeyword property in the component
  const colorPickerInput = document.getElementById('colorPickerInput') as HTMLInputElement;
  colorPickerInput.style.background = selectedColor;
  console.log(colorPickerInput.style.background);
  console.log(selectedColor)

  // Emit the change event to update the rendering
  this.onChange.emit();
  this.changeDetectorRef.detectChanges();
}

// //as soon as a keyword is found, colormind finds th epalette and creates materials for that palette colors instantly PArt 2//////////
// async getNewColorsFromAPI(): Promise<string[]> {
//   const url = "http://colormind.io/api/";
//   const data = {
//     model: "default",
//     input: [this.hexToRgb(this.newshuttle.color), "N", "N", "N"],
//   };

//   return new Promise((resolve, reject) => {
//     const http = new XMLHttpRequest();
//     http.onreadystatechange = function () {
//       if (http.readyState == 4 && http.status == 200) {
//         const palette = JSON.parse(http.responseText).result;
//         const newColors = palette.map((c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
//         resolve(newColors);
//       }
//     };
//     http.open("POST", url, true);
//     http.send(JSON.stringify(data));
//   });
// }
//ends here


  ngOnInit() {
  }


  /**emitted on any action that would change the current rendering */
  change(){
    this.onChange.emit();

  }

  addMaterial(){

  }



  /**
   * handles user input of delete event and reads the "replace" value to reassign draft
   * @param index  - the shuttle to delete
   */
  delete(index:number){

    //never delete all of the shuttles
    if(this.ms.getShuttles().length == 1) return;

    const map: Array<MaterialMap> = this.ms.deleteShuttle(index);
    const dn: Array<DraftNode> = this.tree.getDraftNodes();
    
    
    dn.forEach(dn =>{
      dn.draft.rowShuttleMapping = utilInstance.updateMaterialIds( dn.draft.rowShuttleMapping, map, this.replacements[index]);
      dn.draft.colShuttleMapping = utilInstance.updateMaterialIds( dn.draft.colShuttleMapping, map, this.replacements[index]);

    });

    //remove this from replacements
    this.replacements = this.replacements.filter((el, ndx) => ndx != index);
    //map remaning replacement values to valid indices 
    this.replacements = this.replacements.map(el => (el%this.ms.getShuttles().length));

    this.onChange.emit();
  }

  addNewShuttle(){
    console.log("inside addNewShuttle",this.newshuttle);
    this.newshuttle.setID(this.ms.getShuttles().length);
    this.ms.addShuttle(this.newshuttle);
    this.newshuttle = new Shuttle();
  }

  close() {
    this.dialogRef.close(null);
  }

  save() {
    this.dialogRef.close(null);
  }

}