import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AnswerButton } from '@/components/AnswerFirstOnboarding';
import { useAuth } from '@/providers/auth';
import { useIsPro } from '@/lib/purchases';
import { answersComplete, type Answers } from '@/lib/answerFirst';
import { readAnswerFirst } from '@/lib/answerFirstStorage';
import { C, T } from '@/constants/theme';

export default function FirstPractice() {
  const {user}=useAuth();const access=useIsPro();const router=useRouter();
  const owner=user?.id;
  const [answers,setAnswers]=useState<Answers|null>(null);
  useEffect(()=>{let current=true;setAnswers(null);if(owner)void readAnswerFirst(owner).then(a=>{if(current)setAnswers(a);}).catch(()=>{if(current)setAnswers({});});return()=>{current=false;};},[owner]);
  // No guest/development override. The shared engine also enforces paid backend admission.
  if(!user||!access||!answers||!answersComplete(answers))return <View style={s.root}><Text style={T.body}>{!user||!access?'Verify access before starting spoken practice.':'Your starting focus needs to be loaded or completed.'}</Text><AnswerButton label="Back to my starting focus" onPress={()=>router.replace({pathname:'/answer-onboarding',params:{source:'resume'}})}/></View>;
  // The first paid experience is the canonical lesson, including its rehearsal,
  // observed-signal Index, completion journal, and return to Home.
  return <Redirect href={{pathname:'/approved-lesson/[lessonId]',params:{lessonId:'m1-l1'}}}/>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.bg,padding:22,justifyContent:'center',gap:20}});
