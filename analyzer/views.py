from django.http.response import JsonResponse
from django.shortcuts import render
import pandas as pd
import json
import re
from pandas.core import accessor
from pymongo import MongoClient
import json
from bson import json_util
from fuzzywuzzy import fuzz
# Create your views here.
def parse_json(data):
    return json.loads(json_util.dumps(data))

def hello(request):
    if request.is_ajax():
        type=request.GET.get("type")
        if type=="getDatabases":
            print(request.GET.get("connectionString"))
            return JsonResponse(getDatabasesMongo(request.GET.get("connectionString")), status=200)
        #print("here mate", request)
        elif type=="graph":
            data = request.GET.get('excel_data')
            text = request.GET.get("text")
            return JsonResponse(extractGraphData(text, json.loads(data)), status=200)
        else:
            data = request.GET.get('excel_data')
            text = request.GET.get("text")
            #print("data", json.loads(data)[0])
            return JsonResponse(processTextAndData(text, json.loads(data)), status=200)
    return render(request, 'hello.html')

def jsonToArray(jsons):
  columns=list(jsons[0].keys())
  array=[columns]
  for  json in jsons:
    row=[]
    for  column in columns:
      row.append(json[column])
    
    array.append(row)
  
  return array

def extractGraphData(text,data):
    
    columns=list(data[0].keys())
    chartColumns=[]
    for column in columns:
        if fuzz.partial_ratio(column,text)>80:
            chartColumns.append(column)
        if len(chartColumns)==2:
            break
    if len(chartColumns)<2:
        return {"type": "string", "data": "Please specify the columns for the chart"}
    chartData=filterColumns(data,chartColumns)
    print(chartColumns,"sssssss")
    print(chartData)
    return {"type": "chart", "data": chartData}
    

def filterColumns(data,columnsToKeep):
    data=jsonToArray(data)
    columnIndices=[]
    dataColumns=data[0]
    print(dataColumns)
    for  column in columnsToKeep:
        columnIndices.append(dataColumns.index(column))
    columnSet=set(columnIndices)
    filteredData=[columnsToKeep]
    for row in data[1:]:
        newRow=[]
        for i in range(len(row)):
            if i in columnSet:
                newRow.append(row[i])
            
        
        filteredData.append(newRow)
    return filteredData


def getDatabasesMongo(connection_string):
    try:
        client = MongoClient(connection_string)
        dbs=client.list_database_names()
        final={}
        for db_name in dbs:
            if db_name in ["admin","local"]:
                continue
            db=client[db_name]
            collection_data={}
            collections=db.list_collection_names()
            for collection in collections:
                try:
                    collection_data[collection]=list(db[collection].find({},{"_id":0}))
                except:
                    continue
            final[db_name]=collection_data
        print(final)
        return parse_json({"data":final})
    except Exception as e:
        print(e)
        return {"data":"failed"}


def parseNumber(text):
    try:
        if text is None:
            return None
        if isinstance(text, int) or isinstance(text, float):
            return text
        text = text.strip()
        if text == "":
            return None
        n = re.search("-?[0-9]*([,. ]?[0-9]+)+", text).group(0)
        n = n.strip()
        if not re.match(".*[0-9]+.*", text):
            return None
        while " " in n and "," in n and "." in n:
            index = max(n.rfind(','), n.rfind(' '), n.rfind('.'))
            n = n[0:index]
        n = n.strip()
        symbolsCount = 0
        for current in [" ", ",", "."]:
            if current in n:
                symbolsCount += 1
        if symbolsCount == 0:
            pass
        # With one symbol:
        elif symbolsCount == 1:
            # If this is a space, we just remove all:
            if " " in n:
                n = n.replace(" ", "")
            # Else we set it as a "." if one occurence, or remove it:
            else:
                theSymbol = "," if "," in n else "."
                if n.count(theSymbol) > 1:
                    n = n.replace(theSymbol, "")
                else:
                    n = n.replace(theSymbol, ".")
        else:
            rightSymbolIndex = max(n.rfind(','), n.rfind(' '), n.rfind('.'))
            rightSymbol = n[rightSymbolIndex:rightSymbolIndex+1]
            if rightSymbol == " ":
                return parseNumber(n.replace(" ", "_"))
            n = n.replace(rightSymbol, "R")
            leftSymbolIndex = max(n.rfind(','), n.rfind(' '), n.rfind('.'))
            leftSymbol = n[leftSymbolIndex:leftSymbolIndex+1]
            n = n.replace(leftSymbol, "L")
            n = n.replace("L", "")
            n = n.replace("R", ".")
        n = float(n)
        if n.is_integer():
            return int(n)
        else:
            return int(n)
    except:
        pass
    return None


def processTextAndData(text, data):
    df = pd.DataFrame.from_dict(data)
    df=df.fillna(0)
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='ignore')

    text = text.lower()
    print(df, text)
    lower_to_normal_column_dict = {}
    for column in df.columns:
        lower_to_normal_column_dict[column.lower()] = column
    # Arrange queries
    if "arrange" in text or "sort" in text or "order" in text:
        for column in lower_to_normal_column_dict:
            if fuzz.partial_ratio(column,text)>80:
                asc = True
                if "descending" in text:
                    asc = False
                column_to_sort = lower_to_normal_column_dict[column]
                print(column_to_sort, asc)
                df = df.sort_values(by=column_to_sort, ascending=asc)
                return {"type": "table", "data": df.to_dict(orient='record')}
        return {"type": "string", "data": "Unable to process the qurery"}
    # Maximum and minimum queries
    if "maximum" in text or "minimum" in text or "least" in text or "greatest" in text or "highest" in text or "lowest" in text:
        if "maximum" in text or "greatest" in text or "highest" in text:
            index_to_break = -1
            try:
                index_to_break = text.index("maximum")
            except:
                try:
                    index_to_break = text.index("greatest")
                except:
                    try:
                        index_to_break = text.index("highest")
                    except:
                        print("why lol")
            text = text[index_to_break:]
            for column in lower_to_normal_column_dict:
                if fuzz.partial_ratio(column,text)>80:
                    column = lower_to_normal_column_dict[column]
                    max_column_data = df[column].max()
                    df = df[df[column] == max_column_data]
                    return {"type": "table", "data": df.to_dict(orient='record')}
        if "minimum" in text or "least" in text or "lowest" in text:
            index_to_break = -1
            try:
                index_to_break = text.index("minimum")
            except:
                try:
                    index_to_break = text.index("least")
                except:
                    try:
                        index_to_break = text.index("lowest")
                    except:
                        print("why lol")
            text = text[index_to_break:]
            for column in lower_to_normal_column_dict:
                if fuzz.partial_ratio(column,text)>80:
                    column = lower_to_normal_column_dict[column]
                    min_column_data = df[column].min()
                    df = df[df[column] == min_column_data]
                    return {"type": "table", "data": df.to_dict(orient='record')}
    if "where" in text or "in which" in text:
        index_to_break = -1
        try:
            index_to_break = text.index("where")
        except:
            try:
                index_to_break = text.index("in which")
            except:
                print("lol why")
        text = text[index_to_break:]
        if "greater than" in text or "less than" in text or "smaller than" in text or "more than" in text or "is" in text or "equal to" in text:
            if "greater than" in text or "more than" in text:
                for column in lower_to_normal_column_dict:
                    if fuzz.partial_ratio(column,text)>80:
                        column = lower_to_normal_column_dict[column]
                        numberToCompare = parseNumber(text)
                        print("num", numberToCompare)
                        df = df[df[column] > numberToCompare]
                        return {"type": "table", "data": df.to_dict(orient='record')}
            if "less than" in text or "smaller than" in text:
                for column in lower_to_normal_column_dict:
                    if fuzz.partial_ratio(column,text)>80:
                        column = lower_to_normal_column_dict[column]
                        numberToCompare = parseNumber(text)
                        print("num", numberToCompare)
                        df = df[df[column] < numberToCompare]
                        return {"type": "table", "data": df.to_dict(orient='record')}
            if "equal to" in text or "is" in text:
                for column in lower_to_normal_column_dict:
                    if fuzz.partial_ratio(column,text)>80:
                        column = lower_to_normal_column_dict[column]
                        operator_index = -1
                        len_of_operator = 0
                        try:
                            operator_index = text.index("equal to")
                            len_of_operator = 7
                        except:
                            try:
                                operator_index = text.index("is")
                                len_of_operator = 2
                            except:
                                print("why lol")
                        word_to_match = text[operator_index+len_of_operator+2:]
                        print("match word", word_to_match)
                        df = df[(df[column] == word_to_match) |
                                (df[column].astype(str).str.lower() == word_to_match)]
                        return {"type": "table", "data": df.to_dict(orient='record')}
    return {"type": "string", "data": "Unable to process the qurery"}
