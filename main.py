import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware

model = joblib.load('Mental_Health_Model.pkl')
top_countries = ['Other','India','USA','Canada','Australia','UK','Germany','Mexico','Turkey','France']

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class StudentData(BaseModel):
    age                         : int       = Field(..., ge=10, le=100, description="Age of the student (0-120)")  
    gender                      : Literal['Male', 'Female'] = Field(..., description="Gender of the student")
    country                     : str       = Field(..., description="Country of the student")
    academic_level              : Literal['Undergraduate', 'Graduate', 'High School']       = Field(..., description="Academic level of the student")
    most_used_patform           : Literal[ 'Facebook',  'LinkedIn', 'Instagram',  'Snapchat',   'Twitter',   'YouTube',
    'TikTok',      'LINE', 'KakaoTalk', 'VKontakte',  'WhatsApp',    'WeChat']       = Field(..., description="Most used platform by the student")
    purpose_of_use              : Literal['Networking', 'Education', 'Entertainment', 'News']       = Field(..., description="Purpose of using the platform")
    avg_daily_usage_hours       : float     = Field(..., ge=0, le=24, description="Average daily usage hours")
    daily_unlocks               : int       = Field(..., ge=0, description="Number of times the device is unlocked daily")
    study_hours                 : float     = Field(..., ge=0, le=24, description="Number of study hours per day")
    physical_activity_hours     : float     = Field(..., ge=0, le=10, description="Number of physical activity hours per day")
    sleep_hours_per_night       : float     = Field(..., ge=0, le=24, description="Number of sleep hours per night")
    stress_level                : Literal['Medium', 'Low', 'Very High', 'High']       = Field(..., description="Stress level of the student")

class PredictionResponse(BaseModel):
    predicted_mental_health_score:float

@app.get('/')
def greet():
    return {"message": "Welcome to the Mental Health Prediction API!"}  

@app.post('/predict', response_model=PredictionResponse)
def predict(data: StudentData):

    country_group = data.country if data.country in top_countries else "Other"

    input_row = pd.DataFrame([{
        'Age'                       : data.age,
        'Gender'                    : data.gender,
        'Country'                   : data.country,
        'Academic_Level'            : data.academic_level,
        'Most_Used_Platform'        : data.most_used_patform,
        'Purpose_Of_Use'            : data.purpose_of_use,
        'Avg_Daily_Usage_Hours'     : data.avg_daily_usage_hours,
        'Daily_Unlocks'             : data.daily_unlocks,
        'Study_Hours'               : data.study_hours,
        'Physical_Activity_Hours'   : data.physical_activity_hours,
        'Sleep_Hours_Per_Night'     : data.sleep_hours_per_night,
        'Stress_Level'              : data.stress_level,
        'Grouped_country'           : country_group
    }])

    prediction = model.predict(input_row)[0]

    return PredictionResponse(predicted_mental_health_score=round(float(prediction),2))