from datetime import date

from django.db.models import Sum
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CalorieProfile, CalorieEntry, WaterEntry, WaterProfile
from .permissions import IsCustomer, IsDietician
from .serializers import (
    CalorieProfileSerializer,
    CalorieEntrySerializer,
    DieticianCalorieProfileSerializer,
    DieticianCalorieEntrySerializer,
    WaterProfileSerializer,
    WaterEntrySerializer,
    DieticianWaterProfileSerializer,
    DieticianWaterEntrySerializer,
)


class MyCalorieProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = CalorieProfileSerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_object(self):
        profile, _ = CalorieProfile.objects.get_or_create(
            customer=self.request.user
        )
        return profile


class MyCalorieEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = CalorieEntrySerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        queryset = CalorieEntry.objects.filter(
            customer=self.request.user
        )

        entry_date = self.request.query_params.get("date")

        if entry_date:
            queryset = queryset.filter(date=entry_date)

        return queryset

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)


class MyCalorieEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CalorieEntrySerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return CalorieEntry.objects.filter(
            customer=self.request.user
        )


class MyDailyCalorieSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsCustomer]

    def get(self, request):
        entry_date = request.query_params.get("date")

        if not entry_date:
            entry_date = date.today().isoformat()

        entries = CalorieEntry.objects.filter(
            customer=request.user,
            date=entry_date,
        )

        totals = entries.aggregate(
            calories=Sum("calories"),
            protein_g=Sum("protein_g"),
            carbs_g=Sum("carbs_g"),
            fat_g=Sum("fat_g"),
        )

        profile, _ = CalorieProfile.objects.get_or_create(
            customer=request.user
        )

        calories_consumed = totals["calories"] or 0
        calorie_target = profile.daily_calorie_target

        remaining_calories = None

        if calorie_target is not None:
            remaining_calories = max(
                calorie_target - calories_consumed,
                0,
            )

        return Response({
            "date": entry_date,
            "calorie_target": calorie_target,
            "calories_consumed": calories_consumed,
            "remaining_calories": remaining_calories,
            "protein_g": totals["protein_g"] or 0,
            "carbs_g": totals["carbs_g"] or 0,
            "fat_g": totals["fat_g"] or 0,
        })


class DieticianCalorieProfileDetailView(generics.RetrieveAPIView):
    serializer_class = DieticianCalorieProfileSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_object(self):
        customer_id = self.kwargs["customer_id"]

        profile, _ = CalorieProfile.objects.get_or_create(
            customer_id=customer_id
        )

        return profile


class DieticianCalorieEntryListView(generics.ListAPIView):
    serializer_class = DieticianCalorieEntrySerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        queryset = CalorieEntry.objects.select_related(
            "customer"
        ).all()

        customer_id = self.request.query_params.get("customer")
        entry_date = self.request.query_params.get("date")

        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        if entry_date:
            queryset = queryset.filter(date=entry_date)

        return queryset


class MyWaterProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = WaterProfileSerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_object(self):
        profile, _ = WaterProfile.objects.get_or_create(
            customer=self.request.user
        )
        return profile


class MyWaterEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = WaterEntrySerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        queryset = WaterEntry.objects.filter(
            customer=self.request.user
        )

        entry_date = self.request.query_params.get("date")

        if entry_date:
            queryset = queryset.filter(date=entry_date)

        return queryset

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)


class MyWaterEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WaterEntrySerializer
    permission_classes = [IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return WaterEntry.objects.filter(
            customer=self.request.user
        )


class MyDailyWaterSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsCustomer]

    def get(self, request):
        entry_date = request.query_params.get("date")

        if not entry_date:
            entry_date = date.today().isoformat()

        entries = WaterEntry.objects.filter(
            customer=request.user,
            date=entry_date,
        )

        total_water_ml = (
            entries.aggregate(
                total=Sum("amount_ml")
            )["total"]
            or 0
        )

        profile, _ = WaterProfile.objects.get_or_create(
            customer=request.user
        )

        daily_target = profile.daily_water_target_ml

        remaining_water_ml = None

        if daily_target is not None:
            remaining_water_ml = max(
                daily_target - total_water_ml,
                0,
            )

        progress_percentage = None

        if daily_target and daily_target > 0:
            progress_percentage = round(
                min(
                    (total_water_ml / daily_target) * 100,
                    100,
                ),
                1,
            )

        return Response({
            "date": entry_date,
            "daily_target_ml": daily_target,
            "total_water_ml": total_water_ml,
            "remaining_water_ml": remaining_water_ml,
            "progress_percentage": progress_percentage,
        })
    

class DieticianWaterProfileDetailView(generics.RetrieveAPIView):
    serializer_class = DieticianWaterProfileSerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_object(self):
        customer_id = self.kwargs["customer_id"]

        profile, _ = WaterProfile.objects.get_or_create(
            customer_id=customer_id
        )

        return profile


class DieticianWaterEntryListView(generics.ListAPIView):
    serializer_class = DieticianWaterEntrySerializer
    permission_classes = [IsAuthenticated, IsDietician]

    def get_queryset(self):
        queryset = WaterEntry.objects.select_related(
            "customer"
        ).all()

        customer_id = self.request.query_params.get(
            "customer"
        )

        entry_date = self.request.query_params.get(
            "date"
        )

        if customer_id:
            queryset = queryset.filter(
                customer_id=customer_id
            )

        if entry_date:
            queryset = queryset.filter(
                date=entry_date
            )

        return queryset