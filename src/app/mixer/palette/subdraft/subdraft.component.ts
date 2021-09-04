import { Component, OnInit, Input, Output, ViewChild, ElementRef, EventEmitter, HostListener} from '@angular/core';
import { Draft } from '../../../core/model/draft';
import { Point, Interlacement, Bounds, DraftMap } from '../../../core/model/datatypes';
import { InkService } from '../../provider/ink.service';
import { LayersService } from '../../provider/layers.service';
import utilInstance from '../../../core/model/util';
import { OperationService } from '../../provider/operation.service';
import { TreeService } from '../../provider/tree.service';
import { FileService } from '../../../core/provider/file.service';
import { Loom } from '../../../core/model/loom';
import { ViewportService } from '../../provider/viewport.service';
import { MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DraftdetailComponent } from '../../modal/draftdetail/draftdetail.component';
import { DraftviewerComponent } from '../../../core/draftviewer/draftviewer.component';




interface DesignActions{
  value: string;
  viewValue: string;
  icon: string;
}

@Component({
  selector: 'app-subdraft',
  templateUrl: './subdraft.component.html',
  styleUrls: ['./subdraft.component.scss']
})



export class SubdraftComponent implements OnInit {

  @Input()  id: number; //generated by the tree service
  @Input()  draft: Draft;
  @Input()  patterns: any;
  @Output() onSubdraftMove = new EventEmitter <any>(); 
  @Output() onSubdraftDrop = new EventEmitter <any>(); 
  @Output() onSubdraftStart = new EventEmitter <any>(); 
  @Output() onDeleteCalled = new EventEmitter <any>(); 
  @Output() onDuplicateCalled = new EventEmitter <any>(); 
  @Output() onConnectionMade = new EventEmitter <any>(); 
  @Output() onConnectionRemoved = new EventEmitter <any>(); 
  @Output() onDesignAction = new  EventEmitter <any>();

  @ViewChild('bitmapImage', {static: false}) bitmap: any;
  @ViewChild('bmpLink', {static: true}) bmpLink: any;
  @ViewChild('adaLink', {static: true}) adaLink: any;
  @ViewChild('wifLink', {static: true}) wifLink: any;
  @ViewChild('printLink', {static: true}) printLink: any;

  downloadBmp: ElementRef;
  downloadAda: ElementRef;
  downloadWif: ElementRef;
  downloadPrint: ElementRef;


 //operations you can perform on a selection 
//  design_actions: DesignActions[] = [
//   {value: 'toggle', viewValue: 'Invert Region', icon: "fas fa-adjust"},
//   {value: 'flip_x', viewValue: 'Vertical Flip', icon: "fas fa-arrows-alt-v"},
//   {value: 'flip_y', viewValue: 'Horizontal Flip', icon: "fas fa-arrows-alt-h"},
//   {value: 'shift_left', viewValue: 'Shift 1 Warp Left', icon: "fas fa-arrow-left"},
//   {value: 'shift_up', viewValue: 'Shift 1 Pic Up', icon: "fas fa-arrow-up"},
//   {value: 'duplicate', viewValue: 'Duplicate this Draft', icon: "fa fa-clone"},
//   {value: 'clear', viewValue: 'Clear', icon: "fas fa-eraser"}

// ];

  /**
   * reference to the operation that created this subdraft or -1 if no parent 
   */
  parent_id: number = -1;


  canvas: HTMLCanvasElement;
  cx: any;

  bounds: Bounds = {
    topleft: {x: 0, y: 0},
    width: 0, 
    height: 0
  }

  filename: string = "adacad";

  scale = 10; 

  ink = 'neq'; //can be or, and, neq, not, splice

  counter:number  =  0; // keeps track of how frequently to call the move functions
 
  counter_limit: number = 50;  //this sets the threshold for move calls, lower number == more calls
 
  last_ndx:Interlacement = {i: -1, j:-1, si: -1}; //used to check if we should recalculate a move operation

  moving: boolean  = false;
 
  disable_drag: boolean = false;

  is_preview: boolean = false;
 
  zndx = 0;

  has_active_connection: boolean = false;

  active_connection_order: number = 0;

  set_connectable:boolean = false;


  constructor(private inks: InkService, 
    private layer: LayersService, 
    private ops: OperationService,
    private tree: TreeService,
    private fs: FileService,
    private viewport: ViewportService,
    private dialog: MatDialog) { 
    this.zndx = layer.createLayer();
  }

  ngOnInit(){
    this.bounds.width = this.draft.warps * this.scale;
    this.bounds.height = this.draft.wefts * this.scale;
    this.filename = this.draft.name;

    this.downloadBmp = this.bmpLink._elementRef;
    this.downloadAda = this.adaLink._elementRef;
    this.downloadWif = this.wifLink._elementRef;
    this.downloadPrint = this.printLink._elementRef;

  }


  ngAfterViewInit() {


    this.canvas = <HTMLCanvasElement> document.getElementById(this.id.toString());
    this.cx = this.canvas.getContext("2d");
    this.bounds.width = this.draft.warps * this.scale;
    this.bounds.height = this.draft.wefts * this.scale;
    this.drawDraft();


  }

  rescale(scale:number){

    const inputs: Array<number> = this.tree.getNonCxnInputs(this.id);
    if(inputs.length > 0 && !this.tree.isSibling(this.id)){
      const component: any = this.tree.getComponent(inputs[0]);
      this.bounds.topleft = {x: component.bounds.topleft.x, y: component.bounds.topleft.y + component.bounds.height};
      
    }else{

      let left_incs = this.getTopleft().x / this.scale;
      let top_incs = this.getTopleft().y / this.scale;
      this.bounds.topleft = {x: left_incs*scale, y: top_incs*scale};
    }
     this.scale = scale;

    const container: HTMLElement = document.getElementById('scale-'+this.draft.id);
    container.style.transformOrigin = 'top left';
    container.style.transform = 'scale(' + this.scale/5 + ')';

   
    
    this.bounds.width = this.draft.warps * this.scale;
    this.bounds.height = this.draft.wefts * this.scale;
    // this.drawDraft();

  }


  public setConnectable(){
    this.set_connectable = true;
  }

  public unsetConnectable(){
    this.set_connectable = false;

  }

  public setParent(op: number){
    this.parent_id = op;
  }

  setPosition(pos: Point){
    this.bounds.topleft = pos;
  }



  public inkActionChange(name: any){
    this.ink = name;
    this.inks.select(name);
    this.drawDraft();
  }

  /**
   * gets the next z-ndx to place this in front
   */
  public setAsPreview(){
     this.zndx = this.layer.createLayer();
  }

 

  /**
   * does this subdraft exist at this point?
   * @param p the absolute position of the coordinate (based on the screen)
   * @returns true/false for yes or no
   */
  public hasPoint(p:Point) : boolean{

      const endPosition = {
        x: this.bounds.topleft.x + this.bounds.width,
        y: this.bounds.topleft.y + this.bounds.height,
      };

      if(p.x < this.bounds.topleft.x || p.x > endPosition.x) return false;
      if(p.y < this.bounds.topleft.y || p.y > endPosition.y) return false;

    
    return true;

  }


/**
 * Takes row/column position in this subdraft and translates it to an absolution position  
 * @param ndx the index
 * @returns the absolute position as nxy
 */
 public resolveNdxToPoint(ndx:Interlacement) : Point{
  
  let y = this.bounds.topleft.y + ndx.i * this.scale;
  let x = this.bounds.topleft.x + ndx.j * this.scale;
  return {x: x, y:y};

}

/**
 * Takes an absolute coordinate and translates it to the row/column position Relative to this subdraft
 * @param p the screen coordinate
 * @returns the row and column within the draft (i = row, j=col), returns -1 if out of bounds
 */
  public resolvePointToNdx(p:Point) : Interlacement{
    
    let i = Math.floor((p.y -this.bounds.topleft.y) / this.scale);
    let j = Math.floor((p.x - this.bounds.topleft.x) / this.scale);

    if(i < 0 || i >= this.draft.wefts) i = -1;
    if(j < 0 || j >= this.draft.warps) j = -1;

    return {i: i, j:j, si: i};

  }



/**
 * takes an absolute reference and returns the value at that cell boolean or null if its unset
 * @param p a point of the absolute poistion of coordinate in question
 * @returns true/false/or null representing the eddle value at this point
 */
  public resolveToValue(p:Point) : boolean{

    const coords = this.resolvePointToNdx(p);

    if(coords.i < 0 || coords.j < 0) return null; //this out of range

    if(!this.draft.pattern[coords.i][coords.j].isSet()) return null;
    
    return this.draft.pattern[coords.i][coords.j].isUp();
  
  }

  //I don't think this will ever be called
  updatePositionAndSize(id: number, topleft: Point, width: number, height: number){    
  
    
  }


  /**
   * sets a new draft
   * @param temp the draft to set this component to
   */
  setNewDraft(temp: Draft) {

    this.bounds.width = temp.warps * this.scale;
    this.bounds.height = temp.wefts * this.scale;
    this.draft.reload(temp);

  }

  setComponentPosition(point: Point){
    this.bounds.topleft = point;
  }


  setComponentBounds(bounds: Bounds){
    this.bounds = bounds;
  }
  /**
   * manually sets the component size. While such an operation should be handled on init but there is a bug where this value is checked before the 
   * component runds its init sequence. Manually adding the data makes it possible for check for intersections on selection and drawing end.
   * @param width 
   * @param height 
   */
  setComponentSize(width: number, height: number){
    this.bounds.width = width;
    this.bounds.height = height;
  }


  /**
   * draw whetever is stored in the draft object to the screen
   * @returns 
   */
  drawDraft() {

    if(this.canvas === undefined) return;
   
    this.canvas.width = this.bounds.width;
    this.canvas.height = this.bounds.height;

    for (let i = 0; i < this.draft.wefts; i++) {
      for (let j = 0; j < this.draft.warps; j++) {
        let is_up = this.draft.isUp(i,j);
        let is_set = this.draft.isSet(i, j);
        if(is_set){
          if(this.ink === 'unset' && is_up){
            this.cx.fillStyle = "#999999"; 
          }else{
            this.cx.fillStyle = (is_up) ?  '#000000' :  '#ffffff';
          }
        } else{
          this.cx.fillStyle =  '#0000000d';
         // this.cx.fillStyle =  '#ff0000';

        }
        this.cx.fillRect(j*this.scale, i*this.scale, this.scale, this.scale);
      }
    }
  }


  /**
   * draw onto the supplied canvas, to be used when printing
   * @returns 
   */
   drawForPrint(canvas, cx, scale: number) {

    if(canvas === undefined) return;
   
    for (let i = 0; i < this.draft.wefts; i++) {
      for (let j = 0; j < this.draft.warps; j++) {
        let is_up = this.draft.isUp(i,j);
        let is_set = this.draft.isSet(i, j);
        if(is_set){
          if(this.ink === 'unset' && is_up){
            cx.fillStyle = "#999999"; 
          }else{
            cx.fillStyle = (is_up) ?  '#000000' :  '#ffffff';
          }
        } else{
          cx.fillStyle =  '#0000000d';
        }
        cx.fillRect(j*scale+this.bounds.topleft.x, i*scale+this.bounds.topleft.y, scale, scale);
      }
    }

    //draw the supplemental info like size
    cx.fillStyle = "#666666";
    cx.font = "20px Verdana";

    let datastring: string =  this.draft.warps + " x " + this.draft.wefts;
    cx.fillText(datastring,this.bounds.topleft.x + 5, this.bounds.topleft.y+this.bounds.height + 20 );

  }





  /**
   * gets the position of this elment on the canvas. Dyanic top left might be bigger due to scolling intersection
   * previews. Use static for all calculating of intersections, etc. 
   * @returns 
   */
  getTopleft(): Point{
    return this.bounds.topleft;
  }



  
  isSameBoundsAs(bounds: Bounds) : boolean {   
    if(bounds.topleft.x != this.bounds.topleft.x) return false;
    if(bounds.topleft.y != this.bounds.topleft.y) return false;
    if(bounds.width != this.bounds.width) return false;
    if(bounds.height != this.bounds.height) return false;
    return true;
  }
  

  dragEnd($event: any) {
    this.moving = false;
    this.counter = 0;  
    this.last_ndx = {i: -1, j:-1, si: -1};
    this.onSubdraftDrop.emit({id: this.id});
  }

  dragStart($event: any) {
    this.moving = true;
    this.counter = 0;  
    this.onSubdraftStart.emit({id: this.id});
 

  }

  dragMove($event: any) {
    //position of pointer of the page
    const pointer:Point = $event.pointerPosition;

    const relative:Point = utilInstance.getAdjustedPointerPosition(pointer, this.viewport.getBounds());
    const adj:Point = utilInstance.snapToGrid(relative, this.scale);

    this.bounds.topleft = adj;

    const ndx = utilInstance.resolvePointToAbsoluteNdx(adj, this.scale);
    
    if(this.counter%this.counter_limit === 0 || !utilInstance.isSameNdx(this.last_ndx, ndx)){
      this.onSubdraftMove.emit({id: this.id, point: adj});
      this.counter = 0;
    } 

    this.counter++;
    this.last_ndx = ndx;

  }

  disableDrag(){
    this.disable_drag = true;
  }

  enableDrag(){
    this.disable_drag = false;
  }

  connectionClicked(id:number){
    this.has_active_connection  = true;
    if(this.active_connection_order === 0){
      this.onConnectionMade.emit(id);
    }else{
      this.onConnectionRemoved.emit(id);
    }


  }

  resetConnections(){
    this.has_active_connection = false;
    this.active_connection_order = -1;
  }



  designActionChange(e){

    switch(e){
      case 'duplicate':   
      this.onDuplicateCalled.emit({id: this.id});
      break;

      case 'delete': 
        this.onDeleteCalled.emit({id: this.id});
      break;

      default: 
        const drafts: Array<Draft> = this.ops.getOp(e).perform([this.draft], []);
        drafts.forEach(draft => {
          this.setNewDraft(draft);
          this.drawDraft();
        });
        this.onDesignAction.emit({id: this.id});
      break;

    }
  }

    // fill(id) {

    //   var p = this.patterns[id].pattern;
    //   //need a way to specify an area within the fill
    //   this.draft.fill(p, 'mask');
    //   this.drawDraft();
    //   this.onDesignAction.emit({id: this.id});

    // }

    // clear() {
    //   const c:Cell = new Cell(false);
    //   const pattern = [[c]];
    //   //need a way to specify an area within the fill
    //   this.draft.fill(pattern, 'clear');
    //   this.drawDraft();

    // }
   

    // pasteEvent(type) {

    //   var p = this.draft.pattern;

    //   if(type === undefined) type = "original";

    //  this.draft.fill(p, type);
    //  this.drawDraft();

    // }

    public saveAsBmp(e: any) {
      var obj: any = {
        name: this.filename,
        downloadLink: this.downloadBmp,
        type: "bmp"
      }
      this.onSave(obj);
    }
  
    public saveAsAda(e: any) {
      var obj: any = {
        name: this.filename,
        downloadLink: this.downloadAda,
        type: "ada"
      }
      this.onSave(obj);
    }
  
    public saveAsWif(e: any) {
      var obj: any = {
        name: this.filename,
        downloadLink: this.downloadWif,
        type: "wif"
      }
      this.onSave(obj);
    }
  
    public saveAsPrint(e: any) {
      var obj: any = {
        name: this.filename,
        downloadLink: this.downloadPrint,
        type: "jpg"
      }
      this.onSave(obj);
    }

    public onSave(e: any) {

      e.bitmap = this.bitmap;  
      if (e.type === "bmp"){
        const prev_scale = this.scale;
        this.rescale(1);
    
        let dims = this.scale;
        let b = e.bitmap.nativeElement;
        let context = b.getContext('2d');
    
        b.width = (this.draft.warps ) * dims;
        b.height = (this.draft.wefts) * dims;
        
        context.fillStyle = "white";
        context.fillRect(0,0,b.width,b.height);
        
    
        context.drawImage(this.canvas, 0, 0);
    
    
        let link = e.downloadLink.nativeElement;
        link.href = this.fs.saver.bmp(b);
        link.download = e.name + ".jpg";
        this.rescale(prev_scale);
      }
      else if (e.type === "ada"){
        let link = e.downloadLink.nativeElement;
        link.href = this.fs.saver.ada('draft', [this.draft], [], [], "", false);
        link.download = e.name + ".ada";
      }
      else if (e.type === "wif"){
        //make a loom for saving
        let loom = new Loom(this.draft, 8, 10);
        loom.overloadType("frame");
        loom.recomputeLoom(this.draft);
        
        let link = e.downloadLink.nativeElement;
        link.href= this.fs.saver.wif(this.draft, loom);
        link.download = e.name +".wif";
      } 
      else if (e.type === "jpg"){
        let dims = this.scale;
        let b = e.bitmap.nativeElement;
        let context = b.getContext('2d');

        b.width = (this.draft.warps ) * dims;
        b.height = (this.draft.wefts) * dims;
        
        context.fillStyle = "white";
        context.fillRect(0,0,b.width,b.height);
        

        context.drawImage(this.canvas, 0, 0);
      
        let link = e.downloadLink.nativeElement;
        link.href = this.fs.saver.jpg(b);
        link.download = e.name + ".jpg";
      }      
    }

    finetune(){

      const dialogRef = this.dialog.open(DraftdetailComponent, {
        data: {
          draft: this.draft,
          ink: this.inks.getInk(this.ink).viewValue}
      });

      dialogRef.afterClosed().subscribe(result => {
        console.log("draft returned", result);
          if(result != null){
            if(this.parent_id == -1){
              console.log('overloading draft');
              this.draft.reload(result);
              this.drawDraft();
              this.onDesignAction.emit({id: this.id});
              //flag for downstream calculations
            }else{
              console.log('has operation parent, create and caluculate diff');
            }
          }
        })   
       }

 


}
