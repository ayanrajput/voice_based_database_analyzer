google.charts.load('current', {'packages':['corechart']});
 let allData;
 let originalData;
 let finalData;
let allTableNameAndData={};
// JOIN VARIABLES
let joinType = "JOIN";
let currentlyJoining=false;
let firstTableColumnSelecting=false;
let secondTableColumnSelecting=false;
let firstTableSelectedColumn;
let secondTableSelectedColumn;
let firstTableColumns;
let secondTableColumns;
let secondColumnName;
let secondTable;

 $("#connecting").hide();
 $("#failed").hide();
 $("#databaseSelectionDiv").hide();
 $("#collectionSelectionDiv").hide();
 $("#mainDiv").hide();
 $("#joinDiv").hide();
 function loadEvenetListeners(){
    $("#databaseSelectionDiv li").click(function(e){
        let db=allData[e.target.innerText];
        let ul =document.getElementById("collections");
        ul.innerHTML="";
        for (let collection of Object.keys(db)){
            let ul =document.getElementById("collections");
            let li =document.createElement("li");
            li.innerText=collection;
            ul.appendChild(li);
        }
        $("#databaseSelectionDiv").hide();
        $("#collectionSelectionDiv").show();
        $("#collectionSelectionDiv li").click(function(e){
            originalData=db[e.target.innerText];
            finalData=JSON.parse(JSON.stringify(originalData));
            $("#collectionSelectionDiv").hide();
            $("#mainDiv").show();
            document.getElementById("leftDiv").innerHTML="";
            jsonArrayToTable("leftDiv",finalData);
        })
    })
 }
 document.getElementById("button").addEventListener("click",()=>{
    $("#connect").hide();
    $("#failed").hide();
    $("#connecting").show();
    let connectionString=document.getElementById("input").value;
    console.log(connectionString,"con")
    $.ajax({
        url:'',
        type:'get',
        data:{
            type:"getDatabases",
            connectionString:connectionString
        },
        success:function(res){
            $("#connect").show();
            $("#connecting").hide();
            if (res["data"]=="failed"){
                $("#failed").show();
            }else{
                allData=res["data"];
                for(let data of Object.values(allData)){
                    allTableNameAndData={...data,...allTableNameAndData};
                }
                $("#fileInput").hide();
                $("#databaseSelectionDiv").show();
                for (let key of Object.keys(allData)){
                    let ul =document.getElementById("databases");
                    let li =document.createElement("li");
                    li.innerText=key;
                    ul.appendChild(li);
                }
                loadEvenetListeners()
                console.log(allData);
            }
            
            
        }
    });
 })

 function jsonArrayToTable(divId,arrayToProcess){
    let mainTable=document.createElement('table');
    mainTable.classList.add('styled-table');
    let columns=Object.keys(arrayToProcess[0]);
    let tableHeader=document.createElement('thead');
    let tableHeaderTr=document.createElement("tr");
    for (let column of columns){
        let th=document.createElement('th');
        th.innerText=column;
        tableHeaderTr.appendChild(th)
    }
    tableHeader.appendChild(tableHeaderTr);
    mainTable.appendChild(tableHeader);
    // Now body
    let tableBody=document.createElement("tbody");
    for (let row of arrayToProcess){
        let tableBodyTr=document.createElement('tr');
        for (let column of columns){
            let td=document.createElement("td");
            td.innerText=row[column]?row[column]:"";
            tableBodyTr.appendChild(td);
        }
        tableBody.appendChild(tableBodyTr);
    }
    mainTable.appendChild(tableBody);
    document.getElementById(divId).appendChild(mainTable);
 }
 


$("#speakButton").click(function(){
    let speechRecognition = window.webkitSpeechRecognition;
    let recognition = new speechRecognition();
    // recognition.continuous = true;
    recognition.start();
    recognition.onresult = function (event) {
      let current = event.resultIndex;
      let transcript = event.results[current][0].transcript;
      document.getElementById("queryText").innerText = transcript;
      let type="query";
      if (transcript=="reset"){
        $("#connecting").hide();
        $("#failed").hide();
        $("#databaseSelectionDiv").show();
        $("#collectionSelectionDiv").hide();
        $("#mainDiv").hide();
        $("#joinDiv").hide();
      }
      if(transcript.indexOf("chart")!=-1 || transcript.indexOf("graph")!=-1){
          type="graph"
      }
      if(currentlyJoining==true){
          joinTables(transcript);
      }
      let continueFurther= whetherToJoinData(transcript);
      if (continueFurther==false){
          return;
      }
      $.ajax({
          url:'',
          type:'get',
          data:{
              type:type,
              excel_data:JSON.stringify(finalData),
              text:transcript
          },
          success:function(res){
               //   Removing previous data
                let rightDiv=document.getElementById("rightDiv");
                rightDiv.innerHTML="";
                while(rightDiv.childNodes.length>2){
                    rightDiv.removeChild(rightDiv.lastChild);
                }
                console.log(res["data"],"data");
                if (res["type"]=="table"){
                    jsonArrayToTable("rightDiv",res["data"]);
                }
                if (res["type"]=="chart"){
                    drawChart("rightDiv",res["data"]);
                }
                if (res["type"]=="string"){
                    let h3=document.createElement("h3");
                    h3.innerText=res["data"];
                    rightDiv.appendChild(h3);
                }
              
          }
      });
    };
})

function drawChart(divId,chartData){
    console.log(JSON.stringify(chartData))
    let columns=chartData[0];
    let rows=chartData.slice(1);
    for (let row of rows){
        for (let i=0;i<row.length;i++){
            row[i]=Number(row[i]);
        }
    }
    rows=[columns].concat(rows);
    var data = google.visualization.arrayToDataTable(rows);

    var options = {
        title: columns[0]+' vs. ' +columns[1],
        hAxis: {title: columns[0], minValue: 0, maxValue: 15},
        vAxis: {title: columns[1], minValue: 0, maxValue: 15},
        legend: 'none'
    };

    var chart = new google.visualization.ScatterChart(document.getElementById(divId));

    chart.draw(data, options);
}

function whetherToJoinData(text){
    if (text.indexOf("join")==-1 || !finalData){
        return true
    }
    
    joinType = "JOIN";
    if (text.indexOf("left")!=-1){
        joinType = "LEFT JOIN";
    }
    let allTableNames=Object.keys(allTableNameAndData);
    let userTableName=text.slice(text.indexOf("join")+5);
    const fuseoptions = {
        includeScore: true
    }
    
    const fuse = new Fuse(allTableNames, fuseoptions);
    let secondTableNameList=fuse.search(userTableName);
    if (secondTableNameList.length==0){
        let rightDiv=document.getElementById("rightDiv");
        rightDiv.innerHTML="";
        let h3=document.createElement("h3");
        h3.innerText="Please specify correct table name";
        rightDiv.appendChild(h3);
        return
    }
    currentlyJoining=true;
    firstTableColumnSelecting=true;
    $("#mainDiv").hide(); 
    $("#joinDiv").show();
    secondTable=allTableNameAndData[secondTableNameList[0]["item"]];

    console.log(secondTableNameList,"secondTableNameList")
    firstTableColumns=Object.keys(finalData[0]);
    let firstTabelDiv=document.getElementById('firstTableDiv');
    firstTabelDiv.innerHTML="";
    let ul =document.createElement("ul");
    ul.style.listStyleType=null;
    firstTabelDiv.appendChild(ul)
    for (let column of firstTableColumns){
        let li =document.createElement("li");
        li.innerText=column;
        ul.appendChild(li);
    }
    secondColumnName=secondTableNameList[0]["item"]
    secondTableColumns=Object.keys(secondTable[0]);
    let secondTabelDiv=document.getElementById('secondTableDiv');
    secondTabelDiv.innerHTML="";
    let ul2 =document.createElement("ul");
    ul.style.listStyleType=null;
    secondTabelDiv.appendChild(ul2)
    for (let column of secondTableColumns){
        let li =document.createElement("li");
        li.innerText=column;
        ul2.appendChild(li);
    }
    $("#joinDivHeader").text("Which column to join from left table?")
}

function joinTables(text){
    if (firstTableColumnSelecting==true){
        const options = {
            includeScore: true
        }
        
        const fuse = new Fuse(firstTableColumns, options)
        
        const result = fuse.search(text)
        if (result.length==0){
            return
        }
        firstTableSelectedColumn=result[0]["item"];
        firstTableColumnSelecting=false;
        secondTableColumnSelecting=true;
        $("#joinDivHeader").text("Which column to join from right table?")
    }else if(secondTableColumnSelecting==true){
        const options = {
            includeScore: true
        }
        
        const fuse = new Fuse(secondTableColumns, options)
        
        const result = fuse.search(text)
        if (result.length==0){
            return
        }
        secondTableSelectedColumn=result[0]["item"];
        secondTableColumnSelecting=false;
        currentlyJoining=false;
        // finally joining
        let queryString="Select ";
        let useComma=false
        for (let column of firstTableColumns){
            if (useComma==false){
                queryString+="finalData."+column+" as "+column;
                useComma=true;
                continue;
            }
            queryString+=", "+"finalData."+column+" as "+column;
        }
        for (let column of secondTableColumns){
            if (column==secondTableSelectedColumn){
                continue;
            }
            queryString+=", "+"secondTable."+column + " as "+column;
        }
        queryString+=" From ? finalData "+joinType+" ? secondTable ON finalData."+firstTableSelectedColumn+" = "+"secondTable."+secondTableSelectedColumn;
        console.log(queryString); 
        finalData=alasql(queryString,[finalData,secondTable]);
        document.getElementById("leftDiv").innerHTML="";
        jsonArrayToTable("leftDiv",finalData);
        $("#mainDiv").show(); 
        $("#joinDiv").hide();
    }
    
}